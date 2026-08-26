import type { Request, Response } from 'express';

import { resolveGoogleProfile } from '@/config/passport';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { googleCallbackSchema } from '@/modules/auth/features/google_login/callback/domain/callback.schema';
import { toGoogleProfile } from '@/modules/auth/features/google_login/callback/domain/google_profile.schema';
import { completeGoogleCallback } from '@/modules/auth/features/google_login/callback/presentation/callback.service';
import { buildOauthCallbackLink } from '@/modules/auth/features/google_login/callback/utils/oauth_callback_link';
import { verifyOauthState } from '@/modules/auth/features/google_login/shared/domain/oauth_state';
import { takeOauthStateNonce } from '@/modules/auth/features/google_login/shared/utils/oauth_state_cookie';

export const googleCallbackController = async (req: Request, res: Response): Promise<void> => {
  const payload = googleCallbackSchema.parse(req.query);
  const nonce = takeOauthStateNonce(req, res);
  const redirect_to = verifyOauthState({ state: payload.state, nonce });
  const profile = toGoogleProfile(await resolveGoogleProfile(req, res));
  const result = await completeGoogleCallback({ profile, redirect_to });

  res.redirect(HttpStatusCodes.FOUND.code, buildOauthCallbackLink(result));
};
