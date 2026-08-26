import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { findSessionUser } from '@/modules/auth/features/session/get_me/data/get_me.repository';
import type { GetMePayload } from '@/modules/auth/features/session/get_me/domain/get_me.payload';
import type { GetMeResult } from '@/modules/auth/features/session/get_me/domain/get_me.types';
import { toApiUser } from '@/modules/auth/shared/domain/user_mapper';
import { AppError } from '@/utils/errors';

export const getMeService = async (payload: GetMePayload): Promise<GetMeResult> => {
  const user = await findSessionUser(payload.user_id);

  if (user === null) {
    throw new AppError(AuthMessages.user.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }

  return { user: toApiUser(user) };
};
