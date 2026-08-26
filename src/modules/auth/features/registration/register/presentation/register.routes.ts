import { Router } from 'express';

import { AuthEndpoints } from '@/constants/endpoints';
import { registerRateLimit } from '@/middlewares/rate_limit';
import { registerController } from '@/modules/auth/features/registration/register/presentation/register.controller';

export const registerRouter: Router = Router();

registerRouter.post(AuthEndpoints.register, registerRateLimit, registerController);
