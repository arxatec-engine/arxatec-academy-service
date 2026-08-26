import { Router } from 'express';

import { AuthEndpoints } from '@/constants/endpoints';
import { googleCallbackController } from '@/modules/auth/features/google_login/callback/presentation/callback.controller';

export const googleCallbackRouter: Router = Router();

googleCallbackRouter.get(AuthEndpoints.google_callback, googleCallbackController);
