import type { z } from 'zod';

import type { getMyCoursesSchema } from '@/modules/progress/features/my_courses/get_list/domain/get_list.schema';

export type GetMyCoursesPayload = z.infer<typeof getMyCoursesSchema>;
