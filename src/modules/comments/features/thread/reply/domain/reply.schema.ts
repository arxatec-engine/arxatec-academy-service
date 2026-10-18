import { z } from 'zod';

import { CommentPolicy } from '@/constants/comments';
import { ValidationKeys } from '@/constants/validation_keys';
import { commentBodySchema } from '@/modules/comments/shared/domain/comment_body.schema';

export const replyCommentSchema = z.object({
  user_id: z.string().min(1, ValidationKeys.common.required),
  comment_id: z
    .string()
    .min(1, ValidationKeys.comments.comment_id_required)
    .max(CommentPolicy.id_max_length, ValidationKeys.comments.comment_id_too_long),
  body: commentBodySchema,
});
