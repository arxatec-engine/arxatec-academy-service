import { FileMessages } from '@/constants/messages/files';
import type { StoragePort } from '@/infrastructure/storage/storage.types';

const notImplemented = (): never => {
  throw new Error(FileMessages.s3_not_implemented);
};

export const createS3Storage = (): StoragePort => ({
  save: () => notImplemented(),
  remove: () => notImplemented(),
  publicUrl: () => notImplemented(),
});
