import { z } from 'zod';

import { TeacherPolicy } from '@/constants/courses';
import { ValidationKeys } from '@/constants/validation_keys';

export const teacherSchema = z.object({
  id: z.string().trim().min(1, ValidationKeys.common.required).optional(),
  full_name: z
    .string()
    .trim()
    .min(1, ValidationKeys.common.required)
    .max(TeacherPolicy.full_name_max_length, ValidationKeys.common.invalid),
  biography: z
    .string()
    .trim()
    .min(1, ValidationKeys.common.required)
    .max(TeacherPolicy.biography_max_length, ValidationKeys.common.invalid),
  photo_url: z
    .url({ protocol: /^https?$/, error: ValidationKeys.common.invalid })
    .max(TeacherPolicy.photo_url_max_length, ValidationKeys.common.invalid)
    .nullable()
    .default(null),
});

export type TeacherInput = z.infer<typeof teacherSchema>;
