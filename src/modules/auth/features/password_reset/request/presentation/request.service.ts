import { logger } from '@/config/logger';
import { AuthTokenTtlSeconds } from '@/constants/auth';
import { SystemMessages } from '@/constants/messages/system';
import { sendEmail } from '@/infrastructure/email/send_email';
import { buildPasswordResetEmail } from '@/infrastructure/email/templates/password_reset_email';
import { createOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  findPasswordResetRecipient,
  replacePasswordResetToken,
} from '@/modules/auth/features/password_reset/request/data/request.repository';
import type { RequestPasswordResetPayload } from '@/modules/auth/features/password_reset/request/domain/request.payload';
import type { DeliverPasswordResetEmailInput } from '@/modules/auth/features/password_reset/request/domain/request.types';
import { waitForResponseFloor } from '@/modules/auth/features/password_reset/request/utils/response_floor';

const deliverPasswordResetEmail = async ({
  email,
  token,
  redirect_to,
}: DeliverPasswordResetEmailInput): Promise<void> => {
  try {
    await sendEmail({ to: email, ...buildPasswordResetEmail({ token, redirect_to }) });
  } catch (error) {
    logger.warn({ err: error }, SystemMessages.email_failed);
  }
};

export const requestPasswordReset = async (payload: RequestPasswordResetPayload): Promise<void> => {
  const started_at = Date.now();
  const recipient = await findPasswordResetRecipient(payload.email);

  if (recipient !== null) {
    const now = new Date();
    const issued = createOneTimeToken(AuthTokenTtlSeconds.password_reset, now);

    await replacePasswordResetToken({
      user_id: recipient.id,
      token_hash: issued.token_hash,
      expires_at: issued.expires_at,
      invalidated_at: now,
    });

    void deliverPasswordResetEmail({
      email: recipient.email,
      token: issued.token,
      redirect_to: payload.redirect_to,
    });
  }

  await waitForResponseFloor(started_at);
};
