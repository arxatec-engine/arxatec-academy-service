import { Router } from 'express';

import { passwordForgotRouter } from '@/modules/auth/features/password_reset/request/presentation/request.routes';
import { resetPasswordRouter } from '@/modules/auth/features/password_reset/reset/presentation/reset.routes';

export const passwordResetRouter: Router = Router();

passwordResetRouter.use(passwordForgotRouter);
passwordResetRouter.use(resetPasswordRouter);
