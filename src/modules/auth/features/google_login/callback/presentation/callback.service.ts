import { logger } from '@/config/logger';
import { AuthTokenTtlSeconds } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { auth_provider, user_city } from '@/generated/enums';
import { createOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  createOauthAccount,
  createOauthExchangeToken,
  findLinkableUserByEmail,
  findOauthAccountByProviderAccountId,
  markEmailVerified,
} from '@/modules/auth/features/google_login/callback/data/callback.repository';
import type {
  GoogleCallbackResult,
  GoogleProfilePayload,
  LinkableUserRecord,
} from '@/modules/auth/features/google_login/callback/domain/callback.types';
import { createUser } from '@/modules/auth/shared/data/users.repository';
import { AppError } from '@/utils/errors';

const GOOGLE_ACCOUNT_CITY = user_city.OTHER;

export interface CompleteGoogleCallbackInput {
  profile: GoogleProfilePayload;
  redirect_to: string;
  now?: Date;
}

const linkRefused = (): AppError =>
  new AppError(AuthMessages.google.link_unverified, HttpStatusCodes.BAD_REQUEST.code, {
    code: ErrorCodes.TOKEN_INVALID,
  });

const linkExistingAccount = async (
  user: LinkableUserRecord,
  profile: GoogleProfilePayload,
  now: Date,
): Promise<string> => {
  if (!profile.email_verified) {
    throw linkRefused();
  }

  await createOauthAccount({ user_id: user.id, provider_account_id: profile.provider_account_id });

  if (user.email_verified_at === null) {
    await markEmailVerified(user.id, now);
  }

  logger.info({ user_id: user.id }, AuthMessages.google.account_linked);

  return user.id;
};

const createGoogleAccount = async (profile: GoogleProfilePayload, now: Date): Promise<string> => {
  const created = await createUser({
    full_name: profile.full_name,
    email: profile.email,
    password_hash: null,
    organization: null,
    is_independent: false,
    city: GOOGLE_ACCOUNT_CITY,
    city_other: null,
    avatar_url: profile.avatar_url,
    email_verified_at: profile.email_verified ? now : null,
    auth_provider: auth_provider.GOOGLE,
  });

  await createOauthAccount({
    user_id: created.id,
    provider_account_id: profile.provider_account_id,
  });

  return created.id;
};

const resolveUserId = async (profile: GoogleProfilePayload, now: Date): Promise<string> => {
  const account = await findOauthAccountByProviderAccountId(profile.provider_account_id);

  if (account !== null) {
    return account.user_id;
  }

  const existing = await findLinkableUserByEmail(profile.email);

  if (existing !== null) {
    return linkExistingAccount(existing, profile, now);
  }

  return createGoogleAccount(profile, now);
};

export const completeGoogleCallback = async ({
  profile,
  redirect_to,
  now = new Date(),
}: CompleteGoogleCallbackInput): Promise<GoogleCallbackResult> => {
  const user_id = await resolveUserId(profile, now);
  const exchange_code = createOneTimeToken(AuthTokenTtlSeconds.oauth_exchange_code, now);

  await createOauthExchangeToken({
    user_id,
    token_hash: exchange_code.token_hash,
    expires_at: exchange_code.expires_at,
  });

  return { code: exchange_code.token, redirect_to };
};
