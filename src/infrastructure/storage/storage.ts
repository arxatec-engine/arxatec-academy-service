import { env } from '@/config/env';
import { StorageDrivers } from '@/constants/files';
import { createLocalStorage } from '@/infrastructure/storage/local_storage.adapter';
import { createS3Storage } from '@/infrastructure/storage/s3_storage.adapter';
import type { StoragePort } from '@/infrastructure/storage/storage.types';

export const storage: StoragePort =
  env.STORAGE_DRIVER === StorageDrivers.s3
    ? createS3Storage()
    : createLocalStorage({
        root_path: env.STORAGE_LOCAL_PATH,
        public_url: env.STORAGE_PUBLIC_URL,
      });
