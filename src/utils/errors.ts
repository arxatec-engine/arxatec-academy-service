import type { ErrorCode } from '@/constants/error_codes';

export interface AppErrorMeta {
  code: ErrorCode;
  fields?: Record<string, string>;
  retry_after_seconds?: number;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly meta?: AppErrorMeta;

  constructor(message: string, statusCode: number, meta?: AppErrorMeta) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.meta = meta;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
