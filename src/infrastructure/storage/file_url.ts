import { storage } from '@/infrastructure/storage/storage';

export function resolveStoredFileUrl(url: string, key: string | null): string;
export function resolveStoredFileUrl(url: string | null, key: string | null): string | null;
export function resolveStoredFileUrl(url: string | null, key: string | null): string | null {
  return key === null ? url : storage.readUrl(key);
}
