import { prisma } from '@/config/prisma_client';
import { auth_token_type } from '@/generated/enums';
import type {
  ConsumePasswordResetInput,
  ConsumePasswordResetResult,
  PasswordResetTokenRecord,
} from '@/modules/auth/features/password_reset/reset/domain/reset.types';

const PASSWORD_RESET_TOKEN_SELECT = {
  id: true,
  user_id: true,
  expires_at: true,
  consumed_at: true,
  user: { select: { id: true, email: true, email_verified_at: true } },
} as const;

export const findPasswordResetToken = async (
  token_hash: string,
): Promise<PasswordResetTokenRecord | null> =>
  prisma.auth_tokens.findFirst({
    where: { token_hash, type: auth_token_type.PASSWORD_RESET },
    select: PASSWORD_RESET_TOKEN_SELECT,
  });

export const consumePasswordReset = async (
  input: ConsumePasswordResetInput,
): Promise<ConsumePasswordResetResult> =>
  prisma.$transaction(async (tx) => {
    const consumed = await tx.auth_tokens.updateMany({
      where: { id: input.token_id, consumed_at: null },
      data: { consumed_at: input.now },
    });

    if (consumed.count === 0) {
      return { consumed: false, revoked_sessions: 0 };
    }

    await tx.users.update({
      where: { id: input.user_id },
      data: input.mark_email_verified
        ? { password_hash: input.password_hash, email_verified_at: input.now }
        : { password_hash: input.password_hash },
      select: { id: true },
    });

    const revoked = await tx.auth_sessions.updateMany({
      where: { user_id: input.user_id, revoked_at: null },
      data: { revoked_at: input.now },
    });

    return { consumed: true, revoked_sessions: revoked.count };
  });
