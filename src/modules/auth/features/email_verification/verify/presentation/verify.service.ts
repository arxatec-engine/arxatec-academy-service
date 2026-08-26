import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { hashOneTimeToken, isTokenUsable } from '@/infrastructure/tokens/one_time_token';
import {
  consumeEmailVerificationToken,
  findEmailVerificationTokenByHash,
} from '@/modules/auth/features/email_verification/verify/data/verify.repository';
import type { VerifyEmailPayload } from '@/modules/auth/features/email_verification/verify/domain/verify.payload';
import type { VerifyEmailResult } from '@/modules/auth/features/email_verification/verify/domain/verify.types';
import { AppError } from '@/utils/errors';

const tokenInvalid = (): AppError =>
  new AppError(AuthMessages.email_verification.token_invalid, HttpStatusCodes.BAD_REQUEST.code, {
    code: ErrorCodes.TOKEN_INVALID,
  });

export const verifyEmailService = async (
  { token }: VerifyEmailPayload,
  now: Date = new Date(),
): Promise<VerifyEmailResult> => {
  const record = await findEmailVerificationTokenByHash(hashOneTimeToken(token));

  if (record === null) {
    throw tokenInvalid();
  }

  if (record.user.email_verified_at !== null) {
    return { already_verified: true };
  }

  if (!isTokenUsable(record, now)) {
    throw tokenInvalid();
  }

  const consumed = await consumeEmailVerificationToken({
    token_id: record.id,
    user_id: record.user_id,
    verified_at: now,
  });

  return { already_verified: consumed === 0 };
};
