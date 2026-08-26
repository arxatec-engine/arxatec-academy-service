import { Router } from 'express';

import { ProgressEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { completeLessonController } from '@/modules/progress/features/lesson_progress/complete/presentation/complete.controller';

export const completeLessonRouter: Router = Router();

completeLessonRouter.post(
  ProgressEndpoints.lesson_complete,
  authenticateTokenJwt,
  completeLessonController,
);
