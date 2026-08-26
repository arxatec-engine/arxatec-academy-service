import { Router } from 'express';

import { loginRouter } from '@/modules/auth/features/email_login';
import { emailVerificationRouter } from '@/modules/auth/features/email_verification';
import { googleLoginRouter } from '@/modules/auth/features/google_login';
import { passwordResetRouter } from '@/modules/auth/features/password_reset';
import { registerRouter } from '@/modules/auth/features/registration';
import { sessionRouter } from '@/modules/auth/features/session';

export const authRouter: Router = Router();

authRouter.use(registerRouter);
authRouter.use(loginRouter);
authRouter.use(sessionRouter);
authRouter.use(passwordResetRouter);
authRouter.use(emailVerificationRouter);
authRouter.use(googleLoginRouter);
