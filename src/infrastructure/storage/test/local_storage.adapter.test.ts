import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ErrorCodes } from '@/constants/error_codes';
import { FileUsages, MimeTypes } from '@/constants/files';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { createLocalStorage } from '@/infrastructure/storage/local_storage.adapter';
import type { StoragePort } from '@/infrastructure/storage/storage.types';
import { buildStorageKey } from '@/infrastructure/storage/storage_key';
import { isAppError } from '@/utils/errors';

const PUBLIC_URL = 'http://localhost:3001/files';

const content = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('adaptador local de almacenamiento', () => {
  let root_path = '';
  let storage: StoragePort;

  beforeEach(async () => {
    root_path = await mkdtemp(join(tmpdir(), 'arxatec-storage-'));
    storage = createLocalStorage({ root_path, public_url: PUBLIC_URL });
  });

  afterEach(async () => {
    await rm(root_path, { recursive: true, force: true });
  });

  it('guarda el archivo, devuelve su URL publica y lo deja legible en disco', async () => {
    const key = buildStorageKey({
      usage: FileUsages.course_cover,
      mime_type: MimeTypes.png,
      id: 'portada-de-prueba',
    });

    const stored = await storage.save({ key, content, mime_type: MimeTypes.png });

    expect(stored).toEqual({
      key,
      url: `${PUBLIC_URL}/${key}`,
      mime_type: MimeTypes.png,
      size_bytes: content.byteLength,
    });

    await expect(readFile(join(root_path, key))).resolves.toEqual(content);
  });

  it('publicUrl no toca el disco y concatena la base configurada', () => {
    expect(storage.publicUrl('avatars/maria.png')).toBe(`${PUBLIC_URL}/avatars/maria.png`);
  });

  it('borra lo que guardo', async () => {
    const key = buildStorageKey({
      usage: FileUsages.avatar,
      mime_type: MimeTypes.png,
      id: 'maria',
    });

    await storage.save({ key, content, mime_type: MimeTypes.png });
    await storage.remove(key);

    await expect(readFile(join(root_path, key))).rejects.toThrow();
  });

  it('borrar algo que no existe no revienta', async () => {
    await expect(storage.remove('avatars/no-existe.png')).resolves.toBeUndefined();
  });

  it('rechaza una clave que se sale de la carpeta raiz', async () => {
    expect.assertions(3);

    try {
      await storage.remove('../../etc/passwd');
    } catch (error: unknown) {
      expect(isAppError(error)).toBe(true);

      if (isAppError(error)) {
        expect(error.statusCode).toBe(HttpStatusCodes.BAD_REQUEST.code);
        expect(error.meta?.code).toBe(ErrorCodes.VALIDATION_ERROR);
      }
    }
  });
});
