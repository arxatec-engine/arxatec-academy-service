import type { z } from 'zod';

import type { getCommentsSchema } from '@/modules/comments/features/thread/get_list/domain/get_list.schema';

export type GetCommentsPayload = z.infer<typeof getCommentsSchema>;
