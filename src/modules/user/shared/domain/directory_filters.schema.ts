import { z } from 'zod';

import { AdminUsersPolicy } from '@/constants/admin_users';
import { ValidationKeys } from '@/constants/validation_keys';
import { env } from '@/config/env';
import { course_topic, user_city } from '@/generated/enums';

const csvValues = (value: unknown): string[] => {
  if (typeof value === 'string') {return value.split(',').map((item) => item.trim()).filter(Boolean);}
  if (Array.isArray(value)) {return value.flatMap(csvValues);}
  return [];
};
const booleanParam = z.enum(['true', 'false']).transform((value) => value === 'true');
const dateParam = z.iso.date().transform((value) =>
  new Date(new Date(`${value}T00:00:00.000Z`).getTime() - env.REPORTING_UTC_OFFSET_MINUTES * 60_000));

export const directoryFiltersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  city: z.preprocess(csvValues, z.array(z.enum(user_city)).default([])),
  registered_from: dateParam.optional(), registered_to: dateParam.optional(),
  is_independent: booleanParam.optional(), email_verified: booleanParam.optional(),
  has_completed: booleanParam.optional(),
  completed_topic: z.preprocess(csvValues, z.array(z.enum(course_topic)).default([])),
  sort: z.enum(['created_at', 'full_name']).default('created_at'),
}).refine((value) => value.registered_from === undefined || value.registered_to === undefined
  || value.registered_from <= value.registered_to, {
  path: ['registered_to'], message: ValidationKeys.common.invalid,
});

export const directoryPageSchema = directoryFiltersSchema.safeExtend({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(AdminUsersPolicy.max_per_page)
    .default(AdminUsersPolicy.default_per_page),
});
