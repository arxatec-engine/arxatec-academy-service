import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { auth_provider } from '@/generated/enums';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { verifyPassword } from '@/infrastructure/password/hash_password';
import {
  findLoginCandidateByEmail,
  openLoginSession,
} from '@/modules/auth/features/email_login/login/data/login.repository';
import { DECOY_PASSWORD_HASH } from '@/modules/auth/features/email_login/login/domain/decoy_password_hash';
import type {
  LoginInput,
  LoginResult,
} from '@/modules/auth/features/email_login/login/domain/login.types';
import type { AuthUserWithPassword } from '@/modules/auth/shared/domain/auth_user.types';
import { toApiUser } from '@/modules/auth/shared/domain/user_mapper';
import {
  computeSessionAbsoluteExpiresAt,
  computeSessionExpiresAt,
} from '@/modules/auth/shared/policy/session_policy';
import { AppError } from '@/utils/errors';

const invalidCredentials = (): AppError =>
  new AppError(AuthMessages.login.invalid_credentials, HttpStatusCodes.UNAUTHORIZED.code, {
    code: ErrorCodes.INVALID_CREDENTIALS,
  });

const usesGoogleOnly = (user: AuthUserWithPassword): boolean =>
  user.password_hash === null && user.auth_provider === auth_provider.GOOGLE;

export const loginService = async ({
  payload,
  user_agent,
  ip_address,
  now = new Date(),
}: LoginInput): Promise<LoginResult> => {
  const user = await findLoginCandidateByEmail(payload.email);

  if (user === null) {
    await verifyPassword(DECOY_PASSWORD_HASH, payload.password);

    throw invalidCredentials();
  }

  if (usesGoogleOnly(user)) {
    throw new AppError(AuthMessages.login.account_uses_google, HttpStatusCodes.CONFLICT.code, {
      code: ErrorCodes.ACCOUNT_USES_GOOGLE,
    });
  }

  const password_matches = await verifyPassword(user.password_hash, payload.password);

  if (!password_matches) {
    throw invalidCredentials();
  }

  const session = await openLoginSession({
    user_id: user.id,
    remember_me: payload.remember_me,
    expires_at: computeSessionExpiresAt({ remember_me: payload.remember_me, now }),
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
    user: toApiUser(user),
  };
};
