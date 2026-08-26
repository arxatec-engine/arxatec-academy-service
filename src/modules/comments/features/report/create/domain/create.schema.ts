import { z } from 'zod';

import { CommentPolicy } from '@/constants/comments';
import { ValidationKeys } from '@/constants/validation_keys';

export const createCommentReportSchema = z.object({
  user_id: z.string().min(1, ValidationKeys.common.required),
  comment_id: z
    .string()
    .min(1, ValidationKeys.comments.comment_id_required)
    .max(CommentPolicy.id_max_length, ValidationKeys.comments.comment_id_too_long),
  reason: z
    .string()
    .trim()
    .max(CommentPolicy.reason_max_length, ValidationKeys.comments.reason_too_long)
    .nullish()
    .transform((value) =>
      value === undefined || value === null || value.length === 0 ? null : value,
    ),
});
