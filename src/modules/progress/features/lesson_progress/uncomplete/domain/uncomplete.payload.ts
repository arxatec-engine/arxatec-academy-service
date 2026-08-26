import type { z } from 'zod';

import type { uncompleteLessonSchema } from '@/modules/progress/features/lesson_progress/uncomplete/domain/uncomplete.schema';

export type UncompleteLessonPayload = z.infer<typeof uncompleteLessonSchema>;
