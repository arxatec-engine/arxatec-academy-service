import { Router } from 'express';

import { resendVerificationRouter } from '@/modules/auth/features/email_verification/resend/presentation/resend.routes';
import { verifyEmailRouter } from '@/modules/auth/features/email_verification/verify/presentation/verify.routes';

export const emailVerificationRouter: Router = Router();

emailVerificationRouter.use(verifyEmailRouter);
emailVerificationRouter.use(resendVerificationRouter);
