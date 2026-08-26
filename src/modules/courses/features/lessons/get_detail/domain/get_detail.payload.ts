import type { z } from 'zod';

import type { getDetailSchema } from '@/modules/courses/features/lessons/get_detail/domain/get_detail.schema';

export type GetDetailPayload = z.infer<typeof getDetailSchema>;
