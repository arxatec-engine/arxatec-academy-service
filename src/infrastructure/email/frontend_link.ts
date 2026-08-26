import { env } from '@/config/env';
import { QueryParams } from '@/constants/endpoints';
import { isSafeRedirect } from '@/utils/safe_redirect';

export interface FrontendLinkInput {
  route: string;
  token?: string;
  redirect_to?: string;
}

export const buildFrontendLink = ({ route, token, redirect_to }: FrontendLinkInput): string => {
  const link = new URL(route, env.FRONTEND_URL);

  if (token !== undefined) {
    link.searchParams.set(QueryParams.token, token);
  }

  if (isSafeRedirect(redirect_to)) {
    link.searchParams.set(QueryParams.redirect_to, redirect_to);
  }

  return link.toString();
};
