import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { readStorageEnvironment, storageEnvSchema } from '@/config/storage_env';
import { SystemMessages } from '@/constants/messages/system';

loadDotenv({ quiet: true });

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = storageEnvSchema
  .safeExtend({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z.string().min(1),

    JWT_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().min(1).default('arxatec-academy'),

    FRONTEND_URL: z.url(),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.url(),

    EMAIL_TRANSPORT: z
      .enum(['log', 'smtp'])
      .default(process.env['NODE_ENV'] === 'test' ? 'log' : 'smtp'),
    EMAIL_FROM: z.string().min(1),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
    SMTP_SECURE: booleanFromString.default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),

    VIDEO_PROVIDER_DRIVER: z
      .enum(['live', 'fake', 'vimeo'])
      .default(process.env['NODE_ENV'] === 'production' ? 'live' : 'fake'),
    VIDEO_PROBE_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
    REPORTING_UTC_OFFSET_MINUTES: z.coerce.number().int().default(-300),
    ADMIN_EXPORT_MAX_ROWS: z.coerce.number().int().positive().default(50000),
    NOTIFICATIONS_IP_HASH_SALT: z.string().min(16).default('local-notifications-salt-change-me'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'test' && value.EMAIL_TRANSPORT !== 'smtp') {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_TRANSPORT'],
        message: SystemMessages.env_invalid,
      });
    }
    if (
      value.NODE_ENV === 'production' &&
      value.NOTIFICATIONS_IP_HASH_SALT === 'local-notifications-salt-change-me'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['NOTIFICATIONS_IP_HASH_SALT'],
        message: SystemMessages.env_invalid,
      });
    }
    if (value.EMAIL_TRANSPORT === 'smtp') {
      for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'] as const) {
        if (value[key] === undefined || value[key].length === 0) {
          ctx.addIssue({ code: 'custom', path: [key], message: SystemMessages.env_invalid });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

const readEnvironment = (): Record<string, string> => {
  const source: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value.length > 0) {
      source[key] = value;
    }
  }

  return readStorageEnvironment(source);
};

const parsed = envSchema.safeParse(readEnvironment());

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')} (${issue.message})`)
    .join(', ');

  throw new Error(`${SystemMessages.env_invalid}: ${details}`);
}

export const env: Env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
