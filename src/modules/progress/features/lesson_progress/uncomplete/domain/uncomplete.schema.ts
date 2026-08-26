import { z } from 'zod';

import { ProgressPolicy } from '@/constants/progress';
import { ValidationKeys } from '@/constants/validation_keys';

export const uncompleteLessonSchema = z.object({
  user_id: z.string().min(1, ValidationKeys.common.required),
  lesson_id: z
    .string()
    .min(1, ValidationKeys.progress.lesson_id_required)
    .max(ProgressPolicy.lesson_id_max_length, ValidationKeys.progress.lesson_id_too_long),
  has_session: z.boolean(),
});
