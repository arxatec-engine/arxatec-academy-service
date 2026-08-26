import type { Request } from 'express';

import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import type { AuthenticatedUser } from '@/types/authenticated_user';
import { AppError } from '@/utils/errors';

export const getAuthenticatedUser = (req: Request): AuthenticatedUser => {
  if (req.user === undefined) {
    throw new AppError(AuthMessages.session.unauthenticated, HttpStatusCodes.UNAUTHORIZED.code, {
      code: ErrorCodes.UNAUTHENTICATED,
    });
  }

  return req.user;
};

export const getOptionalUser = (req: Request): AuthenticatedUser | null => req.user ?? null;

export const assertVerifiedEmail = (user: AuthenticatedUser): AuthenticatedUser => {
  if (user.email_verified_at === null) {
    throw new AppError(AuthMessages.email_verification.required, HttpStatusCodes.FORBIDDEN.code, {
      code: ErrorCodes.EMAIL_NOT_VERIFIED,
    });
  }

  return user;
};
