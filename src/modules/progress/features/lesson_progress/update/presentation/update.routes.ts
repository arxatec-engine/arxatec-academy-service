import { Router } from 'express';

import { ProgressEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { lessonProgressRateLimit } from '@/middlewares/rate_limit';
import { updateLessonProgressController } from '@/modules/progress/features/lesson_progress/update/presentation/update.controller';

export const updateLessonProgressRouter: Router = Router();

updateLessonProgressRouter.put(
  ProgressEndpoints.lesson_progress,
  authenticateTokenJwt,
  lessonProgressRateLimit,
  updateLessonProgressController,
);
