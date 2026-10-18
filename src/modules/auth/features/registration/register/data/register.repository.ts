import { prisma } from '@/config/prisma_client';
import { auth_token_type } from '@/generated/enums';
import { normalizeEmail } from '@/modules/auth/shared/domain/normalize_email';

const EMAIL_OWNER_SELECT = { id: true } as const;

const VERIFICATION_TOKEN_SELECT = { id: true, expires_at: true } as const;

export interface CreateEmailVerificationTokenInput {
  user_id: string;
  token_hash: string;
  expires_at: Date;
}

export interface EmailVerificationTokenRecord {
  id: string;
  expires_at: Date;
}

export const isEmailRegistered = async (email: string): Promise<boolean> => {
  const owner = await prisma.users.findUnique({
    where: { email: normalizeEmail(email) },
    select: EMAIL_OWNER_SELECT,
  });

  return owner !== null;
};

export const createEmailVerificationToken = async (
  input: CreateEmailVerificationTokenInput,
): Promise<EmailVerificationTokenRecord> =>
  prisma.auth_tokens.create({
    data: {
      user_id: input.user_id,
      type: auth_token_type.EMAIL_VERIFICATION,
      token_hash: input.token_hash,
      expires_at: input.expires_at,
    },
    select: VERIFICATION_TOKEN_SELECT,
  });

export const invalidateEmailVerificationToken = async (token_id: string): Promise<void> => {
  await prisma.auth_tokens.updateMany({
    where: { id: token_id, consumed_at: null },
    data: { consumed_at: new Date() },
  });
};
