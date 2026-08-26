import { pino, type Logger, type LoggerOptions } from 'pino';

import { env, isDevelopment } from '@/config/env';

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  'password_hash',
  '*.password_hash',
  'token',
  '*.token',
  'token_hash',
  '*.token_hash',
  'access_token',
  '*.access_token',
  'refresh_token',
  '*.refresh_token',
];

const baseOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  redact: { paths: REDACTED_PATHS, remove: true },
};

export const logger: Logger = isDevelopment
  ? pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      },
    })
  : pino(baseOptions);
