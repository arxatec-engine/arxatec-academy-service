import { logger } from '@/config/logger';
import { StorageCleanupPolicy } from '@/constants/files';
import { FileMessages } from '@/constants/messages/files';
import {
  claimStorageDeletion,
  completeStorageDeletion,
  hasStoredFileReferences,
  queueStorageDeletion,
  retryStorageDeletion,
} from '@/infrastructure/storage/cleanup.repository';
import { storage } from '@/infrastructure/storage/storage';
import { isSafeStorageKey } from '@/infrastructure/storage/storage_key';

const processStorageDeletion = async (file_key?: string): Promise<boolean> => {
  const job = await claimStorageDeletion(file_key);
  if (job === null) {
    return false;
  }
  try {
    if (!isSafeStorageKey(job.file_key)) {
      logger.warn(FileMessages.cleanup_invalid_key);
    } else if (!(await hasStoredFileReferences(job.file_key))) {
      await storage.remove(job.file_key);
    }
    await completeStorageDeletion(job);
  } catch (error) {
    await retryStorageDeletion(job);
    logger.warn({ err: error, attempts: job.attempts }, FileMessages.cleanup_retry);
  }
  return true;
};

// The DB triggers already queued detached keys. Also enqueue uploads whose DB write failed.
// A storage outage must not undo a committed deletion or hide the original upload error.
export const removeStoredFile = async (file_key: string | null): Promise<void> => {
  if (file_key === null || !isSafeStorageKey(file_key)) {
    return;
  }
  try {
    await queueStorageDeletion(file_key);
    await processStorageDeletion(file_key);
  } catch (error) {
    logger.warn({ err: error }, FileMessages.cleanup_failed);
  }
};

export const drainStorageDeletions = async (): Promise<void> => {
  try {
    for (let index = 0; index < StorageCleanupPolicy.batch_size; index += 1) {
      if (!(await processStorageDeletion())) {
        break;
      }
    }
  } catch (error) {
    logger.warn({ err: error }, FileMessages.cleanup_failed);
  }
};

export const startStorageCleanupWorker = (): { close: () => Promise<void> } => {
  let stopping = false;
  let pending: Promise<void> | undefined;
  const tick = (): void => {
    if (stopping || pending !== undefined) {
      return;
    }
    pending = drainStorageDeletions().finally(() => {
      pending = undefined;
    });
  };
  const timer = setInterval(tick, StorageCleanupPolicy.interval_ms);
  timer.unref();
  tick();
  return {
    close: async () => {
      stopping = true;
      clearInterval(timer);
      await pending;
    },
  };
};
