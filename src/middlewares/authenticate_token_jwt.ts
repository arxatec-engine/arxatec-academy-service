import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { SessionRejections, type SessionRejection } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import {
  resolveRequestSession,
  type RequestSessionOptions,
} from '@/middlewares/resolve_request_session';
import { touchSession } from '@/modules/auth/shared/data/sessions.repository';
import { resolveSessionRenewal } from '@/modules/auth/shared/policy/session_policy';
import { AppError } from '@/utils/errors';

export type SessionAuthenticatorOptions = RequestSessionOptions;

const unauthenticated = (message: string): AppError =>
  new AppError(message, HttpStatusCodes.UNAUTHORIZED.code, { code: ErrorCodes.UNAUTHENTICATED });

const sessionExpired = (message: string): AppError =>
  new AppError(message, HttpStatusCodes.UNAUTHORIZED.code, { code: ErrorCodes.SESSION_EXPIRED });

const REJECTION_ERRORS: Record<SessionRejection, () => AppError> = {
  [SessionRejections.missing_token]: () => unauthenticated(AuthMessages.session.unauthenticated),
  [SessionRejections.token_invalid]: () => unauthenticated(AuthMessages.session.token_malformed),
  [SessionRejections.token_expired]: () => sessionExpired(AuthMessages.session.expired),
  [SessionRejections.session_not_found]: () => sessionExpired(AuthMessages.session.not_found),
  [SessionRejections.session_mismatch]: () => unauthenticated(AuthMessages.session.token_malformed),
  [SessionRejections.session_revoked]: () => sessionExpired(AuthMessages.session.revoked),
  [SessionRejections.session_expired]: () => sessionExpired(AuthMessages.session.expired),
};

export const createSessionAuthenticator =
  ({ allow_revoked_session }: SessionAuthenticatorOptions): RequestHandler =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const resolved = await resolveRequestSession(req, { allow_revoked_session });

    if (!resolved.authenticated) {
      throw REJECTION_ERRORS[resolved.rejection]();
    }

    const renewal = resolveSessionRenewal({
      remember_me: resolved.session.remember_me,
      created_at: resolved.session.created_at,
      last_used_at: resolved.session.last_used_at,
    });

    if (renewal.should_renew) {
      await touchSession(resolved.session.id, {
        last_used_at: renewal.last_used_at,
        expires_at: renewal.expires_at,
      });
    }

    req.user = resolved.user;

    next();
  };

export const authenticateTokenJwt = createSessionAuthenticator({ allow_revoked_session: false });

export const authenticateRevocableSession = createSessionAuthenticator({
  allow_revoked_session: true,
});
