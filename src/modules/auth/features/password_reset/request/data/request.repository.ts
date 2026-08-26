import { prisma } from '@/config/prisma_client';
import { auth_token_type } from '@/generated/enums';
import type {
  IssuedPasswordResetToken,
  PasswordResetRecipient,
} from '@/modules/auth/features/password_reset/request/domain/request.types';
import { normalizeEmail } from '@/modules/auth/shared/domain/normalize_email';

const PASSWORD_RESET_RECIPIENT_SELECT = {
  id: true,
  email: true,
} as const;

const ISSUED_PASSWORD_RESET_TOKEN_SELECT = {
  id: true,
  expires_at: true,
} as const;

export interface ReplacePasswordResetTokenInput {
  user_id: string;
  token_hash: string;
  expires_at: Date;
  invalidated_at: Date;
}

export const findPasswordResetRecipient = async (
  email: string,
): Promise<PasswordResetRecipient | null> =>
  prisma.users.findUnique({
    where: { email: normalizeEmail(email) },
    select: PASSWORD_RESET_RECIPIENT_SELECT,
  });

export const replacePasswordResetToken = async (
  input: ReplacePasswordResetTokenInput,
): Promise<IssuedPasswordResetToken> =>
  prisma.$transaction(async (tx) => {
    await tx.auth_tokens.updateMany({
      where: {
        user_id: input.user_id,
        type: auth_token_type.PASSWORD_RESET,
        consumed_at: null,
      },
      data: { consumed_at: input.invalidated_at },
    });

    return tx.auth_tokens.create({
      data: {
        user_id: input.user_id,
        type: auth_token_type.PASSWORD_RESET,
        token_hash: input.token_hash,
        expires_at: input.expires_at,
      },
      select: ISSUED_PASSWORD_RESET_TOKEN_SELECT,
    });
  });
