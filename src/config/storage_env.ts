import { z } from 'zod';

import { CloudFrontPolicy, StorageDrivers } from '@/constants/files';
import { SystemMessages } from '@/constants/messages/system';

const productVariables = {
  AWS_S3_BUCKET: 'S3_ACADEMY_PRODUCT_BUCKET',
  STORAGE_PUBLIC_URL: 'CDN_ACADEMY_PRODUCT_BASE_URL',
  CLOUDFRONT_KEY_PAIR_ID: 'CLOUDFRONT_ACADEMY_PRODUCT_KEY_PAIR_ID',
  CLOUDFRONT_PRIVATE_KEY: 'CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY',
  CLOUDFRONT_PRIVATE_KEY_PATH: 'CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY_PATH',
  CLOUDFRONT_URL_TTL_SECONDS: 'CLOUDFRONT_SIGNED_URL_TTL_SECONDS',
} as const;

export const readStorageEnvironment = (source: Record<string, string>): Record<string, string> => {
  const normalized = { ...source };
  if (source['STORAGE_DRIVER'] !== StorageDrivers.s3) {
    return normalized;
  }

  for (const [key, alias] of Object.entries(productVariables)) {
    const value = source[alias]?.trim();
    if (value) {
      normalized[key] = value;
    }
  }
  return normalized;
};

const optionalValue = z.preprocess(
  (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
  z.string().trim().min(1).optional(),
);

export const isValidCdnBaseUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
};

export const storageEnvSchema = z
  .object({
    STORAGE_DRIVER: z.enum([StorageDrivers.local, StorageDrivers.s3]).default(StorageDrivers.local),
    STORAGE_LOCAL_PATH: z.string().trim().min(1).default('storage'),
    STORAGE_PUBLIC_URL: z.url().default('http://localhost:3001/files'),
    AWS_REGION: optionalValue,
    AWS_S3_BUCKET: optionalValue,
    AWS_ACCESS_KEY_ID: optionalValue,
    AWS_SECRET_ACCESS_KEY: optionalValue,
    AWS_SESSION_TOKEN: optionalValue,
    CLOUDFRONT_KEY_PAIR_ID: optionalValue,
    CLOUDFRONT_PRIVATE_KEY: optionalValue,
    CLOUDFRONT_PRIVATE_KEY_PATH: optionalValue,
    CLOUDFRONT_URL_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .max(CloudFrontPolicy.max_url_ttl_seconds)
      .default(CloudFrontPolicy.url_ttl_seconds),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER !== StorageDrivers.s3) {
      return;
    }
    for (const key of ['AWS_REGION', 'AWS_S3_BUCKET', 'CLOUDFRONT_KEY_PAIR_ID'] as const) {
      if (value[key] === undefined) {
        ctx.addIssue({ code: 'custom', path: [key], message: SystemMessages.env_invalid });
      }
    }
    if (!isValidCdnBaseUrl(value.STORAGE_PUBLIC_URL)) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_PUBLIC_URL'],
        message: SystemMessages.env_invalid,
      });
    }
    if (
      (value.CLOUDFRONT_PRIVATE_KEY === undefined) ===
      (value.CLOUDFRONT_PRIVATE_KEY_PATH === undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLOUDFRONT_PRIVATE_KEY'],
        message: SystemMessages.env_invalid,
      });
    }
    if ((value.AWS_ACCESS_KEY_ID === undefined) !== (value.AWS_SECRET_ACCESS_KEY === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['AWS_ACCESS_KEY_ID'],
        message: SystemMessages.env_invalid,
      });
    }
  });
