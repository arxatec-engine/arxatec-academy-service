import { Router } from 'express';

import { getMeRouter } from '@/modules/auth/features/session/get_me/presentation/get_me.routes';
import { logoutRouter } from '@/modules/auth/features/session/logout/presentation/logout.routes';

export const sessionRouter: Router = Router();

sessionRouter.use(getMeRouter);
sessionRouter.use(logoutRouter);
