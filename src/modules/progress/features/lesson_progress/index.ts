import { Router } from 'express';

import { completeLessonRouter } from '@/modules/progress/features/lesson_progress/complete/presentation/complete.routes';
import { uncompleteLessonRouter } from '@/modules/progress/features/lesson_progress/uncomplete/presentation/uncomplete.routes';
import { updateLessonProgressRouter } from '@/modules/progress/features/lesson_progress/update/presentation/update.routes';

export const lessonProgressRouter: Router = Router();

lessonProgressRouter.use(updateLessonProgressRouter);
lessonProgressRouter.use(completeLessonRouter);
lessonProgressRouter.use(uncompleteLessonRouter);
