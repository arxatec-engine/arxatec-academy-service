import { logger } from '@/config/logger';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { SystemMessages } from '@/constants/messages/system';
import { sendEmail } from '@/infrastructure/email/send_email';
import { buildPasswordChangedEmail } from '@/infrastructure/email/templates/password_changed_email';
import { hashPassword } from '@/infrastructure/password/hash_password';
import { hashOneTimeToken, isTokenUsable } from '@/infrastructure/tokens/one_time_token';
import {
  consumePasswordReset,
  findPasswordResetToken,
} from '@/modules/auth/features/password_reset/reset/data/reset.repository';
import type { ResetPasswordPayload } from '@/modules/auth/features/password_reset/reset/domain/reset.payload';
import { AppError } from '@/utils/errors';

const tokenInvalidError = (): AppError =>
  new AppError(AuthMessages.password_reset.token_invalid, HttpStatusCodes.BAD_REQUEST.code, {
    code: ErrorCodes.TOKEN_INVALID,
  });

const notifyPasswordChanged = async (email: string): Promise<void> => {
  try {
    await sendEmail({ to: email, ...buildPasswordChangedEmail() });
  } catch (error) {
    logger.warn({ err: error }, SystemMessages.email_failed);
  }
};

export const resetPassword = async (payload: ResetPasswordPayload): Promise<void> => {
  const now = new Date();
  const token = await findPasswordResetToken(hashOneTimeToken(payload.token));

  if (token === null || !isTokenUsable(token, now)) {
    throw tokenInvalidError();
  }

  const password_hash = await hashPassword(payload.password);

  const result = await consumePasswordReset({
    token_id: token.id,
    user_id: token.user_id,
    password_hash,
    mark_email_verified: token.user.email_verified_at === null,
    now,
  });

  if (!result.consumed) {
    throw tokenInvalidError();
  }

  await notifyPasswordChanged(token.user.email);
};
