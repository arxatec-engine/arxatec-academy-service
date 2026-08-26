import { z } from 'zod';

import { CommentPolicy } from '@/constants/comments';
import { ValidationKeys } from '@/constants/validation_keys';

export const createCommentSchema = z.object({
  user_id: z.string().min(1, ValidationKeys.common.required),
  lesson_id: z
    .string()
    .min(1, ValidationKeys.comments.lesson_id_required)
    .max(CommentPolicy.id_max_length, ValidationKeys.comments.lesson_id_too_long),
  body: z
    .string(ValidationKeys.comments.body_required)
    .trim()
    .min(CommentPolicy.body_min_length, ValidationKeys.comments.body_required)
    .max(CommentPolicy.body_max_length, ValidationKeys.comments.body_too_long),
});
