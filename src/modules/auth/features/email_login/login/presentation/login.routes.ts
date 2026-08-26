import { Router } from 'express';

import { AuthEndpoints } from '@/constants/endpoints';
import { loginByAccountRateLimit, loginByIpRateLimit } from '@/middlewares/rate_limit';
import { loginController } from '@/modules/auth/features/email_login/login/presentation/login.controller';

export const loginRouter: Router = Router();

loginRouter.post(AuthEndpoints.login, loginByIpRateLimit, loginByAccountRateLimit, loginController);
