import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommonMessages } from '@/constants/messages/common';
import { user_role } from '@/generated/enums';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { AppError } from '@/utils/errors';

export const requireAdmin: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const user = getAuthenticatedUser(req);

  if (user.role !== user_role.ADMIN) {
    throw new AppError(CommonMessages.forbidden, HttpStatusCodes.FORBIDDEN.code, {
      code: ErrorCodes.FORBIDDEN,
    });
  }

  next();
};
