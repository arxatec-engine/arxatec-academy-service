import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { resolveRequestSession } from '@/middlewares/resolve_request_session';

export const optionalAuthenticate: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const resolved = await resolveRequestSession(req, { allow_revoked_session: false });

  if (resolved.authenticated) {
    req.user = resolved.user;
  }

  next();
};
