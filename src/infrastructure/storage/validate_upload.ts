import { ErrorCodes } from '@/constants/error_codes';
import {
  FileAllowedMimeTypes,
  FileMaxSizeBytes,
  FileSignatureByMimeType,
  type MimeType,
} from '@/constants/files';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { FileMessages } from '@/constants/messages/files';
import { detectFileSignature } from '@/infrastructure/storage/file_signature';
import type { UploadCandidate, ValidatedUpload } from '@/infrastructure/storage/storage.types';
import { AppError } from '@/utils/errors';

const invalidType = (): AppError =>
  new AppError(FileMessages.invalid_type, HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE.code, {
    code: ErrorCodes.INVALID_FILE_TYPE,
  });

const tooLarge = (): AppError =>
  new AppError(FileMessages.too_large, HttpStatusCodes.PAYLOAD_TOO_LARGE.code, {
    code: ErrorCodes.FILE_TOO_LARGE,
  });

const resolveAllowedMimeType = (usage: UploadCandidate['usage'], mime_type: string): MimeType => {
  const allowed: readonly MimeType[] = FileAllowedMimeTypes[usage];
  const match = allowed.find((candidate) => candidate === mime_type);

  if (match === undefined) {
    throw invalidType();
  }

  return match;
};

export const validateUpload = ({
  usage,
  mime_type,
  size_bytes,
  content,
}: UploadCandidate): ValidatedUpload => {
  if (size_bytes > FileMaxSizeBytes[usage]) {
    throw tooLarge();
  }

  const declared = resolveAllowedMimeType(usage, mime_type);

  if (detectFileSignature(content) !== FileSignatureByMimeType[declared]) {
    throw invalidType();
  }

  return { usage, mime_type: declared, size_bytes };
};
