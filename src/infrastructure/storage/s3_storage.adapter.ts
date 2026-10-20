import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';

import { isValidCdnBaseUrl } from '@/config/storage_env';
import { ErrorCodes } from '@/constants/error_codes';
import { CloudFrontPolicy, S3Policy } from '@/constants/files';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { FileMessages } from '@/constants/messages/files';
import { isPublicStorageKey, isSafeStorageKey } from '@/infrastructure/storage/storage_key';
import type { StoragePort } from '@/infrastructure/storage/storage.types';
import { AppError } from '@/utils/errors';

export interface S3StorageOptions {
  bucket: string;
  region: string;
  public_url: string;
  key_pair_id: string;
  private_key?: string;
  private_key_path?: string;
  url_ttl_seconds?: number;
  credentials?: S3ClientConfig['credentials'];
  client?: { send(command: PutObjectCommand | DeleteObjectCommand): Promise<unknown> };
}

const unavailable = (): AppError =>
  new AppError(FileMessages.storage_unavailable, HttpStatusCodes.SERVICE_UNAVAILABLE.code, {
    code: ErrorCodes.STORAGE_UNAVAILABLE,
  });

const validateKey = (key: string): void => {
  if (!isSafeStorageKey(key)) {
    throw new AppError(FileMessages.storage_key_invalid, HttpStatusCodes.BAD_REQUEST.code, {
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }
};

export const createS3Storage = (options: S3StorageOptions): StoragePort => {
  const ttl = options.url_ttl_seconds ?? CloudFrontPolicy.url_ttl_seconds;
  let privateKey: string;
  try {
    if (
      !options.bucket.trim() ||
      !options.region.trim() ||
      !options.key_pair_id.trim() ||
      !isValidCdnBaseUrl(options.public_url) ||
      !Number.isInteger(ttl) ||
      ttl <= 0 ||
      ttl > CloudFrontPolicy.max_url_ttl_seconds ||
      (options.private_key === undefined) === (options.private_key_path === undefined)
    ) {
      throw new Error();
    }
    const pem = options.private_key ?? readFileSync(options.private_key_path ?? '', 'utf8');
    const parsedKey = createPrivateKey(pem.replace(/\\n/g, '\n'));
    if (
      parsedKey.asymmetricKeyType !== 'rsa' ||
      parsedKey.asymmetricKeyDetails?.modulusLength !== CloudFrontPolicy.rsa_modulus_length
    ) {
      throw new Error();
    }
    privateKey = parsedKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  } catch {
    // Configuration errors fail at startup without exposing the PEM or credentials.
    throw new Error(FileMessages.storage_config_invalid);
  }

  const baseUrl = new URL(options.public_url).href.replace(/\/+$/, '');
  const publicUrl = (key: string): string => {
    validateKey(key);
    return `${baseUrl}/${key}`;
  };
  const client =
    options.client ??
    new S3Client({
      region: options.region,
      ...(options.credentials === undefined ? {} : { credentials: options.credentials }),
      maxAttempts: S3Policy.max_attempts,
      requestHandler: {
        connectionTimeout: S3Policy.connection_timeout_ms,
        requestTimeout: S3Policy.request_timeout_ms,
      },
    });

  return {
    publicUrl,
    readUrl: (key) => {
      const url = publicUrl(key);
      if (isPublicStorageKey(key)) {
        return url;
      }
      try {
        return getSignedUrl({
          url,
          keyPairId: options.key_pair_id,
          privateKey,
          algorithm: 'SHA256',
          dateLessThan: new Date(Date.now() + ttl * 1000).toISOString(),
        });
      } catch {
        throw unavailable();
      }
    },
    save: async ({ key, content, mime_type }) => {
      const url = publicUrl(key);
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: options.bucket,
            Key: key,
            Body: content,
            ContentType: mime_type,
            ContentLength: content.byteLength,
          }),
        );
      } catch {
        throw unavailable();
      }
      return { key, url, mime_type, size_bytes: content.byteLength };
    },
    remove: async (key) => {
      validateKey(key);
      try {
        await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key }));
      } catch {
        throw unavailable();
      }
    },
  };
};
