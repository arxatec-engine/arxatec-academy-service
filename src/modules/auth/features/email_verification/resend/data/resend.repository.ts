import { prisma } from '@/config/prisma_client';
import { auth_token_type } from '@/generated/enums';
import type { RotateEmailVerificationTokenInput } from '@/modules/auth/features/email_verification/resend/domain/resend.types';

export const findLastEmailVerificationSentAt = async (user_id: string): Promise<Date | null> => {
  const token = await prisma.auth_tokens.findFirst({
    where: { user_id, type: auth_token_type.EMAIL_VERIFICATION, consumed_at: null },
    orderBy: { created_at: 'desc' },
    select: { created_at: true },
  });

  return token === null ? null : token.created_at;
};

export const rotateEmailVerificationToken = async ({
  user_id,
  token_hash,
  expires_at,
  invalidated_at,
}: RotateEmailVerificationTokenInput): Promise<string> => {
  const [, created] = await prisma.$transaction([
    prisma.auth_tokens.updateMany({
      where: { user_id, type: auth_token_type.EMAIL_VERIFICATION, consumed_at: null },
      data: { consumed_at: invalidated_at },
    }),
    prisma.auth_tokens.create({
      data: {
        user_id,
        type: auth_token_type.EMAIL_VERIFICATION,
        token_hash,
        expires_at,
      },
      select: { id: true },
    }),
  ]);

  return created.id;
};

export const invalidateResentVerificationToken = async (token_id: string): Promise<void> => {
  await prisma.auth_tokens.updateMany({
    where: { id: token_id, consumed_at: null },
    data: { consumed_at: new Date() },
  });
};
