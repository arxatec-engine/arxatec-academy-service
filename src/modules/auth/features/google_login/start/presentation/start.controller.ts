import type { NextFunction, Request, Response } from 'express';

import { logger } from '@/config/logger';
import { redirectToGoogle } from '@/config/passport';
import { AuthMessages } from '@/constants/messages/auth';
import { setOauthStateNonceCookie } from '@/modules/auth/features/google_login/shared/utils/oauth_state_cookie';
import { googleStartSchema } from '@/modules/auth/features/google_login/start/domain/start.schema';
import { startGoogleLogin } from '@/modules/auth/features/google_login/start/presentation/start.service';

export const googleStartController = (req: Request, res: Response, next: NextFunction): void => {
  const payload = googleStartSchema.parse(req.query);
  const result = startGoogleLogin(payload);

  setOauthStateNonceCookie(res, result.nonce);

  logger.info(
    { request_id: req.request_id, redirect_to: result.redirect_to },
    AuthMessages.google.start,
  );

  redirectToGoogle(result.state)(req, res, next);
};
