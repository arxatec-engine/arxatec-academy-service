import { Router } from 'express';

import { googleCallbackRouter } from '@/modules/auth/features/google_login/callback/presentation/callback.routes';
import { googleExchangeRouter } from '@/modules/auth/features/google_login/exchange/presentation/exchange.routes';
import { googleStartRouter } from '@/modules/auth/features/google_login/start/presentation/start.routes';

export const googleLoginRouter: Router = Router();

googleLoginRouter.use(googleStartRouter);
googleLoginRouter.use(googleCallbackRouter);
googleLoginRouter.use(googleExchangeRouter);
