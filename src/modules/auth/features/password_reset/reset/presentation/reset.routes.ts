import { Router } from 'express';

import { AuthEndpoints } from '@/constants/endpoints';
import { passwordResetRateLimit } from '@/middlewares/rate_limit';
import { resetPasswordController } from '@/modules/auth/features/password_reset/reset/presentation/reset.controller';

export const resetPasswordRouter: Router = Router();

resetPasswordRouter.post(
  AuthEndpoints.password_reset,
  passwordResetRateLimit,
  resetPasswordController,
);
