import { Router } from 'express';

import { UserEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { getSummaryController } from '@/modules/user/features/account/get_summary/presentation/get_summary.controller';

export const getSummaryRouter: Router = Router();

getSummaryRouter.get(UserEndpoints.summary, authenticateTokenJwt, getSummaryController);
