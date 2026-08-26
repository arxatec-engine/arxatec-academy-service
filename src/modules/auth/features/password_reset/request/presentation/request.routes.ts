import { Router } from 'express';

import { AuthEndpoints } from '@/constants/endpoints';
import {
  passwordForgotByEmailRateLimit,
  passwordForgotByIpRateLimit,
} from '@/middlewares/rate_limit';
import { requestPasswordResetController } from '@/modules/auth/features/password_reset/request/presentation/request.controller';

export const passwordForgotRouter: Router = Router();

passwordForgotRouter.post(
  AuthEndpoints.password_forgot,
  passwordForgotByIpRateLimit,
  passwordForgotByEmailRateLimit,
  requestPasswordResetController,
);
