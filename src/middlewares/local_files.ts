import { resolve } from 'node:path';

import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';

import { env } from '@/config/env';
import { StorageDrivers } from '@/constants/files';

const skip: RequestHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

export const localFiles: RequestHandler =
  env.STORAGE_DRIVER === StorageDrivers.local
    ? express.static(resolve(env.STORAGE_LOCAL_PATH), { index: false, dotfiles: 'deny' })
    : skip;
