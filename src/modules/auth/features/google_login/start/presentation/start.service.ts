import type { GoogleStartPayload } from '@/modules/auth/features/google_login/start/domain/start.payload';
import type { GoogleStartResult } from '@/modules/auth/features/google_login/start/domain/start.types';
import { signOauthState } from '@/modules/auth/features/google_login/shared/domain/oauth_state';
import { sanitizeRedirect } from '@/utils/safe_redirect';

export const startGoogleLogin = ({ redirect_to }: GoogleStartPayload): GoogleStartResult => {
  const safe_redirect_to = sanitizeRedirect(redirect_to);
  const signed = signOauthState({ redirect_to: safe_redirect_to });

  return {
    redirect_to: safe_redirect_to,
    state: signed.state,
    nonce: signed.nonce,
  };
};
