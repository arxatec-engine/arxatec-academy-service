import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { StorageDrivers } from '@/constants/files';
import { SystemMessages } from '@/constants/messages/system';

loadDotenv({ quiet: true });

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z
  .object({
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

    EMAIL_TRANSPORT: z.enum(['log', 'smtp']).default('log'),
    EMAIL_FROM: z.string().min(1),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
    SMTP_SECURE: booleanFromString.default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),

    STORAGE_DRIVER: z.enum([StorageDrivers.local, StorageDrivers.s3]).default(StorageDrivers.local),
    STORAGE_LOCAL_PATH: z.string().min(1).default('storage'),
    STORAGE_PUBLIC_URL: z.url().default('http://localhost:3001/files'),

    AWS_REGION: z.string().optional(),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_TRANSPORT === 'smtp') {
      for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'] as const) {
        if (value[key] === undefined || value[key].length === 0) {
          ctx.addIssue({ code: 'custom', path: [key], message: SystemMessages.env_invalid });
        }
      }
    }

    if (value.STORAGE_DRIVER !== StorageDrivers.s3) {
      return;
    }

    for (const key of [
      'AWS_REGION',
      'AWS_S3_BUCKET',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
    ] as const) {
      if (value[key] === undefined || value[key].length === 0) {
        ctx.addIssue({ code: 'custom', path: [key], message: SystemMessages.env_invalid });
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

  return source;
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
