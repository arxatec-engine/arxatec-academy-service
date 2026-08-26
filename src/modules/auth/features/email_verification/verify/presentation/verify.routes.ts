import { Router } from 'express';

import { AuthEndpoints } from '@/constants/endpoints';
import { emailVerifyRateLimit } from '@/middlewares/rate_limit';
import { verifyEmailController } from '@/modules/auth/features/email_verification/verify/presentation/verify.controller';

export const verifyEmailRouter: Router = Router();

verifyEmailRouter.post(AuthEndpoints.email_verify, emailVerifyRateLimit, verifyEmailController);
