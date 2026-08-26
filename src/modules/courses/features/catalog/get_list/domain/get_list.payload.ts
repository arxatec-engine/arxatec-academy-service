import type { z } from 'zod';

import type { getListSchema } from '@/modules/courses/features/catalog/get_list/domain/get_list.schema';

export type GetListPayload = z.infer<typeof getListSchema>;
