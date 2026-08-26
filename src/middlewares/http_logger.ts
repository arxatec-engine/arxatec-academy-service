import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { pinoHttp, type ReqId } from 'pino-http';

import { logger } from '@/config/logger';
import { AuthHeaders } from '@/constants/auth';
import { HealthEndpoints } from '@/constants/endpoints';

interface LoggedRequest {
  id: ReqId;
  method: string | undefined;
  url: string;
}

interface LoggedResponse {
  statusCode: number;
}

const QUERY_SEPARATOR = '?';

const readRequestId = (req: IncomingMessage): string => {
  const value = req.headers[AuthHeaders.request_id];

  return typeof value === 'string' && value.length > 0 ? value : randomUUID();
};

const isHealthCheck = (req: IncomingMessage): boolean => req.url === HealthEndpoints.ping;

const toLoggedPath = (url: string | undefined): string =>
  url === undefined ? '' : url.split(QUERY_SEPARATOR)[0];

const serializeRequest = (req: IncomingMessage): LoggedRequest => ({
  id: req.id,
  method: req.method,
  url: toLoggedPath(req.url),
});

const serializeResponse = (res: ServerResponse): LoggedResponse => ({
  statusCode: res.statusCode,
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: readRequestId,
  autoLogging: { ignore: isHealthCheck },
  wrapSerializers: false,
  serializers: { req: serializeRequest, res: serializeResponse },
});
