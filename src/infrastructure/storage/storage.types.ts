import type { FileUsage, MimeType } from '@/constants/files';

export interface SaveFileInput {
  key: string;
  content: Buffer;
  mime_type: MimeType;
}

export interface StoredFile {
  key: string;
  url: string;
  mime_type: MimeType;
  size_bytes: number;
}

export interface StoragePort {
  save(input: SaveFileInput): Promise<StoredFile>;
  remove(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export interface UploadCandidate {
  usage: FileUsage;
  mime_type: string;
  size_bytes: number;
  content: Buffer;
}

export interface ValidatedUpload {
  usage: FileUsage;
  mime_type: MimeType;
  size_bytes: number;
}
