import { Router } from 'express';

import { ProgressEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { createEnrollmentController } from '@/modules/progress/features/enrollment/create/presentation/create.controller';

export const createEnrollmentRouter: Router = Router();

createEnrollmentRouter.post(
  ProgressEndpoints.enroll,
  authenticateTokenJwt,
  createEnrollmentController,
);
