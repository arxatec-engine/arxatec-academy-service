import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { AppError } from '@/utils/errors';

export const userNotFound = (): AppError =>
  new AppError(AuthMessages.user.not_found, HttpStatusCodes.NOT_FOUND.code, {
    code: ErrorCodes.NOT_FOUND,
  });
