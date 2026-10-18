import { AuthPolicy, AuthTokenTtlSeconds } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { sendEmail } from '@/infrastructure/email/send_email';
import { buildVerificationEmail } from '@/infrastructure/email/templates/verification_email';
import { createOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  findLastEmailVerificationSentAt,
  invalidateResentVerificationToken,
  rotateEmailVerificationToken,
} from '@/modules/auth/features/email_verification/resend/data/resend.repository';
import type {
  ResendVerificationInput,
  ResendVerificationResult,
} from '@/modules/auth/features/email_verification/resend/domain/resend.types';
import { resolveResendCooldown } from '@/modules/auth/features/email_verification/resend/domain/resend_cooldown';
import { AppError } from '@/utils/errors';

const NO_COOLDOWN_SECONDS = 0;

export const resendVerificationService = async (
  { user_id, email, email_verified_at }: ResendVerificationInput,
  now: Date = new Date(),
): Promise<ResendVerificationResult> => {
  if (email_verified_at !== null) {
    return { already_verified: true, retry_after_seconds: NO_COOLDOWN_SECONDS };
  }

  const cooldown = resolveResendCooldown({
    last_sent_at: await findLastEmailVerificationSentAt(user_id),
    now,
  });

  if (!cooldown.allowed) {
    throw new AppError(
      AuthMessages.email_verification.resend_cooldown,
      HttpStatusCodes.TOO_MANY_REQUESTS.code,
      { code: ErrorCodes.RESEND_COOLDOWN, retry_after_seconds: cooldown.retry_after_seconds },
    );
  }

  const { token, token_hash, expires_at } = createOneTimeToken(
    AuthTokenTtlSeconds.email_verification,
    now,
  );

  const token_id = await rotateEmailVerificationToken({
    user_id,
    token_hash,
    expires_at,
    invalidated_at: now,
  });

  try {
    await sendEmail({ to: email, ...buildVerificationEmail({ token }) });
  } catch (error) {
    await invalidateResentVerificationToken(token_id);
    throw error;
  }

  return { already_verified: false, retry_after_seconds: AuthPolicy.resend_cooldown_seconds };
};
