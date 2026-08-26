import { Router } from 'express';

import { AuthEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { getMeController } from '@/modules/auth/features/session/get_me/presentation/get_me.controller';

export const getMeRouter: Router = Router();

getMeRouter.get(AuthEndpoints.me, authenticateTokenJwt, getMeController);
