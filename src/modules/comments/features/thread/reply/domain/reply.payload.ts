import type { z } from 'zod';

import type { replyCommentSchema } from '@/modules/comments/features/thread/reply/domain/reply.schema';

export type ReplyCommentPayload = z.infer<typeof replyCommentSchema>;
