import type { RequestHandler } from 'express';
import multer from 'multer';

import {
  FileMaxSizeBytes,
  FileUploadField,
  FileUploadMaxFiles,
  FileUploadSizeSlack,
  type FileUsage,
} from '@/constants/files';

export const createFileUpload = (usage: FileUsage): RequestHandler =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: FileMaxSizeBytes[usage] + FileUploadSizeSlack,
      files: FileUploadMaxFiles,
    },
  }).single(FileUploadField);
