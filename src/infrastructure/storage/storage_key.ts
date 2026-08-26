import { randomUUID } from 'node:crypto';

import { FileExtensions, StorageKeyPrefix, type FileUsage, type MimeType } from '@/constants/files';

export interface BuildStorageKeyInput {
  usage: FileUsage;
  mime_type: MimeType;
  id?: string;
}

const KEY_PATTERN = /^[a-z0-9_]+\/[a-z0-9-]+\.[a-z0-9]+$/;

export const buildStorageKey = ({
  usage,
  mime_type,
  id = randomUUID(),
}: BuildStorageKeyInput): string =>
  `${StorageKeyPrefix[usage]}/${id}${FileExtensions[mime_type]}`;

export const isSafeStorageKey = (key: string): boolean => KEY_PATTERN.test(key);
