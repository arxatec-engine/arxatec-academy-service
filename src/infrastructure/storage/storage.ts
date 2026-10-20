import { env } from '@/config/env';
import { StorageDrivers } from '@/constants/files';
import { createLocalStorage } from '@/infrastructure/storage/local_storage.adapter';
import { createS3Storage } from '@/infrastructure/storage/s3_storage.adapter';
import type { StoragePort } from '@/infrastructure/storage/storage.types';

export const storage: StoragePort =
  env.STORAGE_DRIVER === StorageDrivers.s3
    ? createS3Storage({
        bucket: env.AWS_S3_BUCKET ?? '',
        region: env.AWS_REGION ?? '',
        public_url: env.STORAGE_PUBLIC_URL,
        key_pair_id: env.CLOUDFRONT_KEY_PAIR_ID ?? '',
        ...(env.CLOUDFRONT_PRIVATE_KEY === undefined
          ? {}
          : { private_key: env.CLOUDFRONT_PRIVATE_KEY }),
        ...(env.CLOUDFRONT_PRIVATE_KEY_PATH === undefined
          ? {}
          : { private_key_path: env.CLOUDFRONT_PRIVATE_KEY_PATH }),
        url_ttl_seconds: env.CLOUDFRONT_URL_TTL_SECONDS,
        ...(env.AWS_ACCESS_KEY_ID === undefined || env.AWS_SECRET_ACCESS_KEY === undefined
          ? {}
          : {
              credentials: {
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
                ...(env.AWS_SESSION_TOKEN === undefined
                  ? {}
                  : { sessionToken: env.AWS_SESSION_TOKEN }),
              },
            }),
      })
    : createLocalStorage({
        root_path: env.STORAGE_LOCAL_PATH,
        public_url: env.STORAGE_PUBLIC_URL,
      });
