import { z } from 'zod';

import { ModerationPolicy } from '@/constants/comments';
import { commentBodySchema } from '@/modules/comments/shared/domain/comment_body.schema';

export const moderationQuerySchema = z.object({
  tab: z.enum(['recent', 'reported', 'hidden']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(ModerationPolicy.max_page_size)
    .default(ModerationPolicy.default_page_size),
});
export const moderationIdSchema = z.object({ id: z.string().min(1) });
export const moderationReplySchema = z.object({ body: commentBodySchema });
export const moderationStatusSchema = z.object({ status: z.enum(['HIDDEN', 'VISIBLE']) });
