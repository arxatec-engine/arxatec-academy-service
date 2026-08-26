import { prisma } from '@/config/prisma_client';
import { auth_token_type } from '@/generated/enums';
import type { OauthExchangeTokenRecord } from '@/modules/auth/features/google_login/exchange/domain/exchange.types';

const OAUTH_EXCHANGE_TOKEN_SELECT = {
  id: true,
  user_id: true,
  expires_at: true,
  consumed_at: true,
} as const;

export const findOauthExchangeToken = async (
  token_hash: string,
): Promise<OauthExchangeTokenRecord | null> =>
  prisma.auth_tokens.findFirst({
    where: { token_hash, type: auth_token_type.OAUTH_EXCHANGE },
    select: OAUTH_EXCHANGE_TOKEN_SELECT,
  });

export const consumeOauthExchangeToken = async (id: string, consumed_at: Date): Promise<number> => {
  const result = await prisma.auth_tokens.updateMany({
    where: { id, type: auth_token_type.OAUTH_EXCHANGE, consumed_at: null },
    data: { consumed_at },
  });

  return result.count;
};
