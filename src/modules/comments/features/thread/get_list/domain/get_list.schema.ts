import { z } from 'zod';

import { CommentPolicy } from '@/constants/comments';
import { ValidationKeys } from '@/constants/validation_keys';

export const getCommentsSchema = z.object({
  lesson_id: z
    .string()
    .min(1, ValidationKeys.comments.lesson_id_required)
    .max(CommentPolicy.id_max_length, ValidationKeys.comments.lesson_id_too_long),
});
