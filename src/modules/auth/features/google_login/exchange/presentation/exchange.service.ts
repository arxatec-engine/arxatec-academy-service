import { resolveStoredFileUrl } from '@/infrastructure/storage/file_url';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { hashOneTimeToken, isTokenUsable } from '@/infrastructure/tokens/one_time_token';
import {
  consumeOauthExchangeToken,
  findOauthExchangeToken,
} from '@/modules/auth/features/google_login/exchange/data/exchange.repository';
import { createSession } from '@/modules/auth/shared/data/sessions.repository';
import { findUserById } from '@/modules/auth/shared/data/users.repository';
import type { ApiSession } from '@/modules/auth/shared/domain/session.types';
import { toApiUser } from '@/modules/auth/shared/domain/user_mapper';
import {
  computeSessionAbsoluteExpiresAt,
  computeSessionExpiresAt,
} from '@/modules/auth/shared/policy/session_policy';
import { AppError } from '@/utils/errors';

const GOOGLE_SESSION_REMEMBER_ME = true;

export interface ExchangeGoogleCodeInput {
  code: string;
  user_agent?: string | null;
  ip_address?: string | null;
  now?: Date;
}

const invalidCode = (): AppError =>
  new AppError(AuthMessages.google.code_invalid, HttpStatusCodes.BAD_REQUEST.code, {
    code: ErrorCodes.TOKEN_INVALID,
  });

export const exchangeGoogleCode = async ({
  code,
  user_agent = null,
  ip_address = null,
  now = new Date(),
}: ExchangeGoogleCodeInput): Promise<ApiSession> => {
  const token = await findOauthExchangeToken(hashOneTimeToken(code));

  if (token === null || !isTokenUsable(token, now)) {
    throw invalidCode();
  }

  if ((await consumeOauthExchangeToken(token.id, now)) === 0) {
    throw invalidCode();
  }

  const user = await findUserById(token.user_id);

  if (user === null) {
    throw new AppError(AuthMessages.user.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }

  const session = await createSession({
    user_id: user.id,
    remember_me: GOOGLE_SESSION_REMEMBER_ME,
    expires_at: computeSessionExpiresAt({ remember_me: GOOGLE_SESSION_REMEMBER_ME, now }),
    user_agent,
    ip_address,
  });

  return {
    token: signSessionToken({
      user_id: user.id,
      session_id: session.id,
      role: user.role,
      absolute_expires_at: computeSessionAbsoluteExpiresAt(session.created_at),
      issued_at: now,
    }),
    expires_at: session.expires_at.toISOString(),
    user: toApiUser(user, resolveStoredFileUrl),
  };
};
