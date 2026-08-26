import type { z } from 'zod';

import type { getSummarySchema } from '@/modules/user/features/account/get_summary/domain/get_summary.schema';

export type GetSummaryPayload = z.infer<typeof getSummarySchema>;
