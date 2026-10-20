import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import type * as CloudFrontSigner from '@aws-sdk/cloudfront-signer';

import { ErrorCodes } from '@/constants/error_codes';
import { MimeTypes } from '@/constants/files';
import { FileMessages } from '@/constants/messages/files';
import {
  createS3Storage,
  type S3StorageOptions,
} from '@/infrastructure/storage/s3_storage.adapter';

jest.mock('@aws-sdk/cloudfront-signer', () => {
  const actual = jest.requireActual<typeof CloudFrontSigner>('@aws-sdk/cloudfront-signer');
  return { ...actual, getSignedUrl: jest.fn(actual.getSignedUrl) };
});

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const send = jest.fn<Promise<unknown>, [PutObjectCommand | DeleteObjectCommand]>();
const client = { send };
const options: S3StorageOptions = {
  bucket: 'academy-test',
  region: 'us-east-1',
  public_url: 'https://cdn.example.test/academy/',
  key_pair_id: 'KTESTKEY',
  private_key: pem,
  url_ttl_seconds: 300,
  client,
};
const key = 'private/lesson_resources/1234-abcd.pdf';

afterEach(() => {
  jest.useRealTimers();
});
beforeEach(() => {
  send.mockResolvedValue({ $metadata: {} });
});

describe('S3 + CloudFront privado', () => {
  it('entrega /public/ sin firma y conserva /private/ firmado', () => {
    const storage = createS3Storage(options);
    const publicKey = 'public/course_covers/1234-abcd.png';
    expect(storage.readUrl(publicKey)).toBe(`https://cdn.example.test/academy/${publicKey}`);
    expect(getSignedUrl).not.toHaveBeenCalled();
    expect(new URL(storage.readUrl(key)).searchParams.has('Signature')).toBe(true);
  });

  it('mantiene las claves legacy sin root como privadas al leer', () => {
    expect(
      new URL(createS3Storage(options).readUrl('lesson_resources/legacy.pdf')).searchParams.has(
        'Signature',
      ),
    ).toBe(true);
  });

  it('sube los bytes y el MIME sin ACL pública y devuelve una URL estable para persistencia', async () => {
    const content = Buffer.from('%PDF-test');
    const storage = createS3Storage(options);
    const stored = await storage.save({ key, content, mime_type: MimeTypes.pdf });

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    if (!(command instanceof PutObjectCommand)) {
      throw new Error('Expected PutObjectCommand');
    }
    expect(command.input).toEqual({
      Bucket: options.bucket,
      Key: key,
      Body: content,
      ContentType: MimeTypes.pdf,
      ContentLength: content.byteLength,
    });
    expect(stored).toEqual({
      key,
      url: `https://cdn.example.test/academy/${key}`,
      mime_type: MimeTypes.pdf,
      size_bytes: content.byteLength,
    });
    expect(new URL(stored.url).search).toBe('');
  });

  it('elimina en el bucket configurado, incluso si el objeto ya no existe', async () => {
    await expect(createS3Storage(options).remove(key)).resolves.toBeUndefined();
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    if (!(command instanceof DeleteObjectCommand)) {
      throw new Error('Expected DeleteObjectCommand');
    }
    expect(command.input).toEqual({ Bucket: options.bucket, Key: key });
  });

  it('firma con RSA SHA256 el recurso exacto y renueva el vencimiento al volver a leer', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-19T12:00:00Z'));
    const storage = createS3Storage(options);
    const url = new URL(storage.readUrl(key));
    const expires = Number(url.searchParams.get('Expires'));
    expect(expires).toBe(Math.floor(Date.now() / 1000) + 300);
    expect(url.searchParams.get('Key-Pair-Id')).toBe('KTESTKEY');
    expect(url.searchParams.get('Hash-Algorithm')).toBe('SHA256');
    const policy = JSON.stringify({
      Statement: [
        {
          Resource: storage.publicUrl(key),
          Condition: { DateLessThan: { 'AWS:EpochTime': expires } },
        },
      ],
    });
    const signature = Buffer.from(
      (url.searchParams.get('Signature') ?? '')
        .replace(/-/g, '+')
        .replace(/_/g, '=')
        .replace(/~/g, '/'),
      'base64',
    );
    expect(verify('RSA-SHA256', Buffer.from(policy), publicKey, signature)).toBe(true);
    expect(
      verify(
        'RSA-SHA256',
        Buffer.from(policy.replace(key, 'lesson_resources/other.pdf')),
        publicKey,
        signature,
      ),
    ).toBe(false);

    jest.advanceTimersByTime(60_000);
    const renewed = new URL(storage.readUrl(key));
    expect(Number(renewed.searchParams.get('Expires'))).toBe(expires + 60);
    expect(renewed.href).not.toBe(url.href);
  });

  it.each([
    '../secret.pem',
    'avatars/../../secret.png',
    '/avatars/a.png',
    'avatars/a.png?x=1',
    'https://other.test/a.pdf',
    'lesson_resources/%2e%2e.pdf',
  ])('rechaza la clave insegura %s antes de tocar S3 o firmar', async (unsafe) => {
    const storage = createS3Storage(options);
    expect(() => storage.readUrl(unsafe)).toThrow(FileMessages.storage_key_invalid);
    expect(() => storage.publicUrl(unsafe)).toThrow(FileMessages.storage_key_invalid);
    await expect(
      storage.save({ key: unsafe, content: Buffer.from('x'), mime_type: MimeTypes.pdf }),
    ).rejects.toMatchObject({ statusCode: 400, meta: { code: ErrorCodes.VALIDATION_ERROR } });
    await expect(storage.remove(unsafe)).rejects.toMatchObject({ statusCode: 400 });
    expect(send).not.toHaveBeenCalled();
  });

  it('traduce fallos de AWS a 503 sin exponer detalles del proveedor', async () => {
    send.mockRejectedValue(new Error('secret AWS internal detail'));
    const storage = createS3Storage(options);
    const expected = {
      message: FileMessages.storage_unavailable,
      statusCode: 503,
      meta: { code: ErrorCodes.STORAGE_UNAVAILABLE },
    };
    await expect(
      storage.save({ key, content: Buffer.from('x'), mime_type: MimeTypes.pdf }),
    ).rejects.toMatchObject(expected);
    await expect(storage.remove(key)).rejects.toMatchObject(expected);
  });

  it('no devuelve una URL sin firma si el firmador falla', () => {
    jest.mocked(getSignedUrl).mockImplementationOnce(() => {
      throw new Error('signer failed');
    });
    expect(() => createS3Storage(options).readUrl(key)).toThrow(FileMessages.storage_unavailable);
  });

  it.each([
    'http://cdn.test',
    'https://user:pass@cdn.test',
    'https://cdn.test?x=1',
    'https://cdn.test/#fragment',
  ])('impide arrancar con una base CDN inválida: %s', (public_url) => {
    expect(() => createS3Storage({ ...options, public_url })).toThrow(
      FileMessages.storage_config_invalid,
    );
  });

  it('impide arrancar sin una clave RSA válida', () => {
    expect(() => createS3Storage({ ...options, private_key: 'invalid pem' })).toThrow(
      FileMessages.storage_config_invalid,
    );
    const ecKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
    expect(() =>
      createS3Storage({
        ...options,
        private_key: ecKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      }),
    ).toThrow(FileMessages.storage_config_invalid);
  });

  it('acepta PEM con saltos escapados desde un gestor de secretos', () => {
    expect(
      new URL(
        createS3Storage({ ...options, private_key: pem.replace(/\n/g, '\\n') }).readUrl(key),
      ).searchParams.has('Signature'),
    ).toBe(true);
  });

  it('acepta un archivo PEM y falla al inicio si no existe', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'academy-cdn-test-'));
    const fileOptions = { ...options };
    delete fileOptions.private_key;
    const private_key_path = join(dir, 'private.pem');
    try {
      expect(() => createS3Storage({ ...fileOptions, private_key_path })).toThrow(
        FileMessages.storage_config_invalid,
      );
      await writeFile(private_key_path, pem, { mode: 0o600 });
      expect(
        new URL(
          createS3Storage({ ...fileOptions, private_key_path }).readUrl(key),
        ).searchParams.has('Signature'),
      ).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
