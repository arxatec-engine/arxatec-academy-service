import { Router } from 'express';

import { AuthEndpoints } from '@/constants/endpoints';
import { authenticateRevocableSession } from '@/middlewares/authenticate_token_jwt';
import { logoutController } from '@/modules/auth/features/session/logout/presentation/logout.controller';

export const logoutRouter: Router = Router();

logoutRouter.post(AuthEndpoints.logout, authenticateRevocableSession, logoutController);
