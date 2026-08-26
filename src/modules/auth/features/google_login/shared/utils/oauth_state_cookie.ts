import type { CookieOptions, Request, Response } from 'express';

import { isProduction } from '@/config/env';
import { AuthCookies, AuthPolicy } from '@/constants/auth';
import { ApiPrefix, AuthRoutePrefix } from '@/constants/endpoints';

const MILLISECONDS_PER_SECOND = 1000;

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: `${ApiPrefix}${AuthRoutePrefix}`,
  maxAge: AuthPolicy.oauth_state_max_age_seconds * MILLISECONDS_PER_SECOND,
};

const readCookie = (req: Request, name: string): string => {
  const jar: unknown = req.cookies;

  if (typeof jar !== 'object' || jar === null || !(name in jar)) {
    return '';
  }

  const value: unknown = Reflect.get(jar, name);

  return typeof value === 'string' ? value : '';
};

export const setOauthStateNonceCookie = (res: Response, nonce: string): void => {
  res.cookie(AuthCookies.oauth_state_nonce, nonce, cookieOptions);
};

export const takeOauthStateNonce = (req: Request, res: Response): string => {
  const nonce = readCookie(req, AuthCookies.oauth_state_nonce);

  res.clearCookie(AuthCookies.oauth_state_nonce, cookieOptions);

  return nonce;
};
