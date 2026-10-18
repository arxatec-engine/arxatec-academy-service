import type { ErrorCode } from '@/constants/error_codes';

export interface AppErrorMeta {
  code: ErrorCode;
  fields?: Record<string, string>;
  retry_after_seconds?: number;
  row_count?: number;
  max_rows?: number;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly meta?: AppErrorMeta;
  public readonly data?: unknown;

  constructor(message: string, statusCode: number, meta?: AppErrorMeta, data?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.meta = meta;
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
