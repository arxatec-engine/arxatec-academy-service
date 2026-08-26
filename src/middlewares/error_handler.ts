import type { Express, NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

import { logger } from '@/config/logger';
import { ErrorCodes } from '@/constants/error_codes';
import { MulterErrorCodes } from '@/constants/files';
import { HttpStatusCodes, type HttpStatus } from '@/constants/http_status_codes';
import { CommonMessages } from '@/constants/messages/common';
import { FileMessages } from '@/constants/messages/files';
import { SystemMessages } from '@/constants/messages/system';
import { ValidationKeys, ValidationRootField, isI18nKey } from '@/constants/validation_keys';
import { buildHttpResponse, type HttpResponseMeta } from '@/utils/build_http_response';
import { isAppError } from '@/utils/errors';

type ZodIssueOf = ZodError['issues'][number];

interface ResolvedError {
  status: HttpStatus;
  description: string;
  meta: HttpResponseMeta;
}

const STATUS_BY_CODE = new Map<number, HttpStatus>(
  Object.values(HttpStatusCodes).map((status) => [status.code, status]),
);

const toStatus = (code: number): HttpStatus =>
  STATUS_BY_CODE.get(code) ?? HttpStatusCodes.INTERNAL_SERVER_ERROR;

const toFieldName = (issue: ZodIssueOf): string => {
  const segments = issue.path
    .filter((segment): segment is string | number => typeof segment !== 'symbol')
    .map((segment) => String(segment));

  return segments.length === 0 ? ValidationRootField : segments.join('.');
};

const toFieldKeys = (error: ZodError): Record<string, string> => {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = toFieldName(issue);

    if (fields[field] === undefined) {
      fields[field] = isI18nKey(issue.message) ? issue.message : ValidationKeys.common.invalid;
    }
  }

  return fields;
};

const readNumericStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  for (const key of ['statusCode', 'status'] as const) {
    if (key in error) {
      const value: unknown = Reflect.get(error, key);

      if (typeof value === 'number' && value >= 400 && value < 500) {
        return value;
      }
    }
  }

  return undefined;
};

const isFileTooLargeError = (error: unknown): boolean =>
  error instanceof multer.MulterError && error.code === MulterErrorCodes.file_too_large;

const resolveError = (error: unknown): ResolvedError => {
  if (isAppError(error)) {
    return {
      status: toStatus(error.statusCode),
      description: error.message,
      meta: error.meta ?? { code: ErrorCodes.INTERNAL_ERROR },
    };
  }

  if (isFileTooLargeError(error)) {
    return {
      status: HttpStatusCodes.PAYLOAD_TOO_LARGE,
      description: FileMessages.too_large,
      meta: { code: ErrorCodes.FILE_TOO_LARGE },
    };
  }

  if (error instanceof multer.MulterError) {
    return {
      status: HttpStatusCodes.BAD_REQUEST,
      description: CommonMessages.validation_error,
      meta: { code: ErrorCodes.VALIDATION_ERROR },
    };
  }

  if (error instanceof ZodError) {
    return {
      status: HttpStatusCodes.UNPROCESSABLE_ENTITY,
      description: CommonMessages.validation_error,
      meta: { code: ErrorCodes.VALIDATION_ERROR, fields: toFieldKeys(error) },
    };
  }

  const numericStatus = readNumericStatus(error);

  if (numericStatus === HttpStatusCodes.PAYLOAD_TOO_LARGE.code) {
    return {
      status: HttpStatusCodes.PAYLOAD_TOO_LARGE,
      description: CommonMessages.payload_too_large,
      meta: { code: ErrorCodes.VALIDATION_ERROR },
    };
  }

  if (numericStatus !== undefined) {
    return {
      status: HttpStatusCodes.BAD_REQUEST,
      description: CommonMessages.validation_error,
      meta: { code: ErrorCodes.VALIDATION_ERROR },
    };
  }

  return {
    status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
    description: CommonMessages.internal_error,
    meta: { code: ErrorCodes.INTERNAL_ERROR },
  };
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(HttpStatusCodes.NOT_FOUND.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.NOT_FOUND,
      description: CommonMessages.not_found,
      path: req.originalUrl,
      meta: { code: ErrorCodes.NOT_FOUND },
    }),
  );
};

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(error);

    return;
  }

  const resolved = resolveError(error);
  const context = {
    err: error,
    request_id: req.request_id,
    method: req.method,
    path: req.originalUrl,
    status: resolved.status.code,
    code: resolved.meta.code,
  };

  if (resolved.status.code >= HttpStatusCodes.INTERNAL_SERVER_ERROR.code) {
    logger.error(context, SystemMessages.unhandled_error);
  } else {
    logger.warn(context, SystemMessages.unhandled_error);
  }

  res.status(resolved.status.code).json(
    buildHttpResponse({
      status: resolved.status,
      description: resolved.description,
      path: req.originalUrl,
      meta: resolved.meta,
    }),
  );
};

export const registerErrorHandler = (app: Express): void => {
  app.use(notFoundHandler);
  app.use(errorHandler);
};
