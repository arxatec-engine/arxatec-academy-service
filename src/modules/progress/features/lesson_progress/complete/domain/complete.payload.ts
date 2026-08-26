import type { z } from 'zod';

import type { completeLessonSchema } from '@/modules/progress/features/lesson_progress/complete/domain/complete.schema';

export type CompleteLessonPayload = z.infer<typeof completeLessonSchema>;
