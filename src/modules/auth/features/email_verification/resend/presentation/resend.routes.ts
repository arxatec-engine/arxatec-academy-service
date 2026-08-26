import { Router } from 'express';

import { AuthEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { emailResendRateLimit } from '@/middlewares/rate_limit';
import { resendVerificationController } from '@/modules/auth/features/email_verification/resend/presentation/resend.controller';

export const resendVerificationRouter: Router = Router();

resendVerificationRouter.post(
  AuthEndpoints.email_resend,
  authenticateTokenJwt,
  emailResendRateLimit,
  resendVerificationController,
);
