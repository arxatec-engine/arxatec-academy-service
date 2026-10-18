import type { ErrorCode } from '@/constants/error_codes';
import type { HttpStatus } from '@/constants/http_status_codes';

export interface HttpResponseMeta {
  code?: ErrorCode;
  fields?: Record<string, string>;
  retry_after_seconds?: number;
  row_count?: number;
  max_rows?: number;
  pagination?: { page: number; per_page: number; total: number; total_pages: number };
}

export interface BuildHttpResponseInput<TData> {
  status: HttpStatus;
  description: string;
  path: string;
  data?: TData;
  meta?: HttpResponseMeta;
}

export interface HttpResponse<TData> {
  status: number;
  message: string;
  description: string;
  timestamp: string;
  path: string;
  data?: TData;
  meta?: HttpResponseMeta;
}

export const buildHttpResponse = <TData>({
  status,
  description,
  path,
  data,
  meta,
}: BuildHttpResponseInput<TData>): HttpResponse<TData> => {
  const response: HttpResponse<TData> = {
    status: status.code,
    message: status.message,
    description,
    timestamp: new Date().toISOString(),
    path,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (meta !== undefined) {
    response.meta = meta;
  }

  return response;
};
