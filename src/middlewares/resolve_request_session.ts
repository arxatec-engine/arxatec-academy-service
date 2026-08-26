import type { Request } from 'express';

import { AuthHeaders, SessionRejections, type SessionRejection } from '@/constants/auth';
import { readSessionToken } from '@/infrastructure/jwt/verify_session_token';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import type { SessionWithUser } from '@/modules/auth/shared/domain/session.types';
import { isSessionExpired, isSessionRevoked } from '@/modules/auth/shared/policy/session_policy';
import type { AuthenticatedUser } from '@/types/authenticated_user';

export interface RequestSessionOptions {
  allow_revoked_session: boolean;
}

export type ResolvedRequestSession =
  | { authenticated: true; session: SessionWithUser; user: AuthenticatedUser }
  | { authenticated: false; rejection: SessionRejection };

const rejected = (rejection: SessionRejection): ResolvedRequestSession => ({
  authenticated: false,
  rejection,
});

export const readBearerToken = (req: Request): string | null => {
  const header = req.headers[AuthHeaders.authorization];

  if (typeof header !== 'string' || !header.startsWith(AuthHeaders.bearer_prefix)) {
    return null;
  }

  const token = header.slice(AuthHeaders.bearer_prefix.length).trim();

  return token.length === 0 ? null : token;
};

export const toAuthenticatedUser = (session: SessionWithUser): AuthenticatedUser => ({
  id: session.user.id,
  email: session.user.email,
  role: session.user.role,
  session_id: session.id,
  email_verified_at: session.user.email_verified_at,
});

export const resolveRequestSession = async (
  req: Request,
  { allow_revoked_session }: RequestSessionOptions,
): Promise<ResolvedRequestSession> => {
  const token = readBearerToken(req);

  if (token === null) {
    return rejected(SessionRejections.missing_token);
  }

  const decoded = readSessionToken(token);

  if (!decoded.valid) {
    return rejected(
      decoded.expired ? SessionRejections.token_expired : SessionRejections.token_invalid,
    );
  }

  const session = await findSessionById(decoded.payload.jti);

  if (session === null) {
    return rejected(SessionRejections.session_not_found);
  }

  if (session.user_id !== decoded.payload.sub) {
    return rejected(SessionRejections.session_mismatch);
  }

  const status = { expires_at: session.expires_at, revoked_at: session.revoked_at };

  if (!allow_revoked_session && isSessionRevoked(status)) {
    return rejected(SessionRejections.session_revoked);
  }

  if (isSessionExpired(status)) {
    return rejected(SessionRejections.session_expired);
  }

  return { authenticated: true, session, user: toAuthenticatedUser(session) };
};
