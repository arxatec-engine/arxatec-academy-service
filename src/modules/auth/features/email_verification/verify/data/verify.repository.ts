import { prisma } from '@/config/prisma_client';
import { auth_token_type } from '@/generated/enums';
import type {
  ConsumeEmailVerificationTokenInput,
  EmailVerificationTokenRecord,
} from '@/modules/auth/features/email_verification/verify/domain/verify.types';

const EMAIL_VERIFICATION_TOKEN_SELECT = {
  id: true,
  user_id: true,
  expires_at: true,
  consumed_at: true,
  user: { select: { id: true, email_verified_at: true } },
} as const;

export const findEmailVerificationTokenByHash = async (
  token_hash: string,
): Promise<EmailVerificationTokenRecord | null> =>
  prisma.auth_tokens.findFirst({
    where: { token_hash, type: auth_token_type.EMAIL_VERIFICATION },
    select: EMAIL_VERIFICATION_TOKEN_SELECT,
  });

export const consumeEmailVerificationToken = async ({
  token_id,
  user_id,
  verified_at,
}: ConsumeEmailVerificationTokenInput): Promise<number> => {
  const [consumed] = await prisma.$transaction([
    prisma.auth_tokens.updateMany({
      where: { id: token_id, consumed_at: null },
      data: { consumed_at: verified_at },
    }),
    prisma.users.updateMany({
      where: { id: user_id, email_verified_at: null },
      data: { email_verified_at: verified_at },
    }),
  ]);

  return consumed.count;
};
