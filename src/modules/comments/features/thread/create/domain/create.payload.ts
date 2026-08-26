import type { z } from 'zod';

import type { createCommentSchema } from '@/modules/comments/features/thread/create/domain/create.schema';

export type CreateCommentPayload = z.infer<typeof createCommentSchema>;
