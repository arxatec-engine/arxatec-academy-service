import { logger } from '@/config/logger';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { SystemMessages } from '@/constants/messages/system';
import { UserMessages } from '@/constants/messages/user';
import { sendEmail } from '@/infrastructure/email/send_email';
import { buildPasswordChangedEmail } from '@/infrastructure/email/templates/password_changed_email';
import { hashPassword, verifyPassword } from '@/infrastructure/password/hash_password';
import type { UpdatePasswordPayload } from '@/modules/user/features/profile/update_password/domain/update_password.payload';
import type { UpdatePasswordResult } from '@/modules/user/features/profile/update_password/domain/update_password.types';
import {
  changeUserPassword,
  findUserCredentialsById,
} from '@/modules/user/shared/data/user_account.repository';
import { userNotFound } from '@/modules/user/shared/domain/user_not_found';
import { AppError } from '@/utils/errors';

const notifyPasswordChanged = async (email: string): Promise<void> => {
  try {
    await sendEmail({ to: email, ...buildPasswordChangedEmail() });
  } catch (error) {
    logger.warn({ err: error }, SystemMessages.email_failed);
  }
};

export const updatePasswordService = async (
  payload: UpdatePasswordPayload,
): Promise<UpdatePasswordResult> => {
  const user = await findUserCredentialsById(payload.user_id);

  if (user === null) {
    throw userNotFound();
  }

  if (user.password_hash === null) {
    throw new AppError(
      UserMessages.password.account_uses_google,
      HttpStatusCodes.CONFLICT.code,
      { code: ErrorCodes.ACCOUNT_USES_GOOGLE },
    );
  }

  if (!(await verifyPassword(user.password_hash, payload.current_password))) {
    throw new AppError(UserMessages.password.current_invalid, HttpStatusCodes.UNAUTHORIZED.code, {
      code: ErrorCodes.INVALID_CREDENTIALS,
    });
  }

  const password_hash = await hashPassword(payload.new_password);

  const revoked_sessions = await changeUserPassword({
    user_id: payload.user_id,
    session_id: payload.session_id,
    password_hash,
    now: new Date(),
  });

  await notifyPasswordChanged(user.email);

  return { revoked_sessions };
};
