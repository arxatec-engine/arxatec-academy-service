import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { assertVerifiedEmail, getAuthenticatedUser } from '@/utils/authenticated_user';

export const requireVerifiedEmail: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  assertVerifiedEmail(getAuthenticatedUser(req));

  next();
};
