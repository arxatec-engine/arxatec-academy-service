import type { Request } from 'express';

import { ErrorCodes } from '@/constants/error_codes';
import { FileUploadField } from '@/constants/files';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommonMessages } from '@/constants/messages/common';
import { ValidationKeys } from '@/constants/validation_keys';
import { AppError } from '@/utils/errors';

export interface UploadedFile {
  mime_type: string;
  size_bytes: number;
  content: Buffer;
}

export const requireUploadedFile = (req: Request): UploadedFile => {
  if (req.file === undefined) {
    throw new AppError(CommonMessages.validation_error, HttpStatusCodes.UNPROCESSABLE_ENTITY.code, {
      code: ErrorCodes.VALIDATION_ERROR,
      fields: { [FileUploadField]: ValidationKeys.common.required },
    });
  }

  return { mime_type: req.file.mimetype, size_bytes: req.file.size, content: req.file.buffer };
};
