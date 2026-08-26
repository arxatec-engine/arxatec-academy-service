import type { z } from 'zod';

import type { updateLessonProgressSchema } from '@/modules/progress/features/lesson_progress/update/domain/update.schema';

export type UpdateLessonProgressPayload = z.infer<typeof updateLessonProgressSchema>;
