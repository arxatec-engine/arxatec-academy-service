import { prisma } from '@/config/prisma_client';
import { auth_token_type, oauth_provider } from '@/generated/enums';
import type {
  LinkableUserRecord,
  OauthAccountRecord,
} from '@/modules/auth/features/google_login/callback/domain/callback.types';
import { normalizeEmail } from '@/modules/auth/shared/domain/normalize_email';

const OAUTH_ACCOUNT_SELECT = {
  id: true,
  user_id: true,
} as const;

const LINKABLE_USER_SELECT = {
  id: true,
  email_verified_at: true,
} as const;

export interface CreateOauthAccountInput {
  user_id: string;
  provider_account_id: string;
}

export interface CreateOauthExchangeTokenInput {
  user_id: string;
  token_hash: string;
  expires_at: Date;
}

export const findOauthAccountByProviderAccountId = async (
  provider_account_id: string,
): Promise<OauthAccountRecord | null> =>
  prisma.oauth_accounts.findUnique({
    where: {
      provider_provider_account_id: {
        provider: oauth_provider.GOOGLE,
        provider_account_id,
      },
    },
    select: OAUTH_ACCOUNT_SELECT,
  });

export const createOauthAccount = async (
  input: CreateOauthAccountInput,
): Promise<OauthAccountRecord> =>
  prisma.oauth_accounts.create({
    data: {
      user_id: input.user_id,
      provider: oauth_provider.GOOGLE,
      provider_account_id: input.provider_account_id,
    },
    select: OAUTH_ACCOUNT_SELECT,
  });

export const findLinkableUserByEmail = async (email: string): Promise<LinkableUserRecord | null> =>
  prisma.users.findUnique({
    where: { email: normalizeEmail(email) },
    select: LINKABLE_USER_SELECT,
  });

export const markEmailVerified = async (user_id: string, verified_at: Date): Promise<number> => {
  const result = await prisma.users.updateMany({
    where: { id: user_id, email_verified_at: null },
    data: { email_verified_at: verified_at },
  });

  return result.count;
};

export const createOauthExchangeToken = async (
  input: CreateOauthExchangeTokenInput,
): Promise<string> => {
  const created = await prisma.auth_tokens.create({
    data: {
      user_id: input.user_id,
      type: auth_token_type.OAUTH_EXCHANGE,
      token_hash: input.token_hash,
      expires_at: input.expires_at,
    },
    select: { id: true },
  });

  return created.id;
};
