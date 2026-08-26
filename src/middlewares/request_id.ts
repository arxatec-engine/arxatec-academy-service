import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { AuthHeaders } from '@/constants/auth';
import { ServerPolicy } from '@/constants/server';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]+$/;

const readIncomingId = (value: string | string[] | undefined): string | undefined => {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (candidate === undefined || candidate.length === 0) {
    return undefined;
  }

  if (candidate.length > ServerPolicy.request_id_max_length) {
    return undefined;
  }

  return SAFE_REQUEST_ID.test(candidate) ? candidate : undefined;
};

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = readIncomingId(req.headers[AuthHeaders.request_id]) ?? randomUUID();

  req.request_id = id;
  req.headers[AuthHeaders.request_id] = id;
  res.setHeader(AuthHeaders.request_id, id);

  next();
};
