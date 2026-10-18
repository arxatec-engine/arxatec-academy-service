import { z } from 'zod';
import { ValidationKeys } from '@/constants/validation_keys';
export const courseExamParamsSchema = z.object({
  slug: z.string().min(1, ValidationKeys.common.required).max(160),
});
export const adminExamParamsSchema = z.object({
  id: z.string().min(1, ValidationKeys.common.required).max(128),
});
