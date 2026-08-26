import type { z } from 'zod';

import type { createCommentReportSchema } from '@/modules/comments/features/report/create/domain/create.schema';

export type CreateCommentReportPayload = z.infer<typeof createCommentReportSchema>;
