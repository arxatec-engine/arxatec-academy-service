import { z } from 'zod';

import { CoursePolicy } from '@/constants/courses';
import { ValidationKeys } from '@/constants/validation_keys';

export const getDetailSchema = z.object({
  slug: z
    .string()
    .min(1, ValidationKeys.courses.slug_required)
    .max(CoursePolicy.slug_max_length, ValidationKeys.courses.slug_too_long),
  has_session: z.boolean(),
});
