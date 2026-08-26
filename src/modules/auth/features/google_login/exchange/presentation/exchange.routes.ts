import { Router } from 'express';

import { AuthEndpoints } from '@/constants/endpoints';
import { googleExchangeRateLimit } from '@/middlewares/rate_limit';
import { googleExchangeController } from '@/modules/auth/features/google_login/exchange/presentation/exchange.controller';

export const googleExchangeRouter: Router = Router();

googleExchangeRouter.post(
  AuthEndpoints.google_exchange,
  googleExchangeRateLimit,
  googleExchangeController,
);
