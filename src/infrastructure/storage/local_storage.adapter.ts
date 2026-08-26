import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { FileMessages } from '@/constants/messages/files';
import { isSafeStorageKey } from '@/infrastructure/storage/storage_key';
import type {
  SaveFileInput,
  StoragePort,
  StoredFile,
} from '@/infrastructure/storage/storage.types';
import { AppError } from '@/utils/errors';

export interface LocalStorageOptions {
  root_path: string;
  public_url: string;
}

const invalidKey = (): AppError =>
  new AppError(FileMessages.storage_key_invalid, HttpStatusCodes.BAD_REQUEST.code, {
    code: ErrorCodes.VALIDATION_ERROR,
  });

export const createLocalStorage = ({ root_path, public_url }: LocalStorageOptions): StoragePort => {
  const root = resolve(root_path);

  const toAbsolutePath = (key: string): string => {
    if (!isSafeStorageKey(key)) {
      throw invalidKey();
    }

    return join(root, key);
  };

  const publicUrl = (key: string): string => `${public_url}/${key}`;

  return {
    publicUrl,

    save: async ({ key, content, mime_type }: SaveFileInput): Promise<StoredFile> => {
      const path = toAbsolutePath(key);

      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);

      return { key, url: publicUrl(key), mime_type, size_bytes: content.byteLength };
    },

    remove: async (key: string): Promise<void> => {
      await rm(toAbsolutePath(key), { force: true });
    },
  };
};
