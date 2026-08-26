import { Router } from 'express';

import { ProgressEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { uncompleteLessonController } from '@/modules/progress/features/lesson_progress/uncomplete/presentation/uncomplete.controller';

export const uncompleteLessonRouter: Router = Router();

uncompleteLessonRouter.delete(
  ProgressEndpoints.lesson_complete,
  authenticateTokenJwt,
  uncompleteLessonController,
);
