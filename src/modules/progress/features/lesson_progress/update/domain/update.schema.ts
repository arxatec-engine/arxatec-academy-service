import { z } from 'zod';

import { ProgressPolicy } from '@/constants/progress';
import { ValidationKeys } from '@/constants/validation_keys';

export const updateLessonProgressSchema = z.object({
  user_id: z.string().min(1, ValidationKeys.common.required),
  lesson_id: z
    .string()
    .min(1, ValidationKeys.progress.lesson_id_required)
    .max(ProgressPolicy.lesson_id_max_length, ValidationKeys.progress.lesson_id_too_long),
  has_session: z.boolean(),
  last_position_seconds: z
    .int(ValidationKeys.progress.position_invalid)
    .min(ProgressPolicy.min_position_seconds, ValidationKeys.progress.position_invalid)
    .max(ProgressPolicy.max_position_seconds, ValidationKeys.progress.position_invalid),
  completed: z.boolean(ValidationKeys.progress.completed_invalid).default(false),
});
