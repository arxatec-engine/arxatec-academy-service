import { env } from '@/config/env';
import { FrontendRoutes, QueryParams } from '@/constants/endpoints';
import type { GoogleCallbackResult } from '@/modules/auth/features/google_login/callback/domain/callback.types';
import { isSafeRedirect } from '@/utils/safe_redirect';

export const buildOauthCallbackLink = ({ code, redirect_to }: GoogleCallbackResult): string => {
  const link = new URL(FrontendRoutes.oauth_callback, env.FRONTEND_URL);

  link.searchParams.set(QueryParams.code, code);

  if (isSafeRedirect(redirect_to)) {
    link.searchParams.set(QueryParams.redirect_to, redirect_to);
  }

  return link.toString();
};
