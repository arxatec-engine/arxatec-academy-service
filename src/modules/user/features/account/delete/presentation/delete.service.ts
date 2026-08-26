import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { verifyPassword } from '@/infrastructure/password/hash_password';
import type { DeleteAccountPayload } from '@/modules/user/features/account/delete/domain/delete.payload';
import { removeStoredAvatar } from '@/modules/user/shared/data/avatar_storage';
import {
  deleteUserAccount,
  findUserAvatar,
  findUserCredentialsById,
} from '@/modules/user/shared/data/user_account.repository';
import { userNotFound } from '@/modules/user/shared/domain/user_not_found';
import { AppError } from '@/utils/errors';

const invalidCredentials = (message: string): AppError =>
  new AppError(message, HttpStatusCodes.UNAUTHORIZED.code, {
    code: ErrorCodes.INVALID_CREDENTIALS,
  });

const assertPasswordMatches = async (
  password_hash: string,
  password: string | null | undefined,
): Promise<void> => {
  if (password === null || password === undefined || password.length === 0) {
    throw invalidCredentials(UserMessages.account.password_required);
  }

  if (!(await verifyPassword(password_hash, password))) {
    throw invalidCredentials(UserMessages.password.current_invalid);
  }
};

export const deleteAccountService = async (payload: DeleteAccountPayload): Promise<void> => {
  const user = await findUserCredentialsById(payload.user_id);

  if (user === null) {
    throw userNotFound();
  }

  if (user.password_hash !== null) {
    await assertPasswordMatches(user.password_hash, payload.password);
  }

  const avatar = await findUserAvatar(payload.user_id);

  await deleteUserAccount(payload.user_id);
  await removeStoredAvatar(avatar?.avatar_key ?? null);
};
