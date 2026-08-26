import { Router } from 'express';

import { AuthEndpoints } from '@/constants/endpoints';
import { googleStartController } from '@/modules/auth/features/google_login/start/presentation/start.controller';

export const googleStartRouter: Router = Router();

googleStartRouter.get(AuthEndpoints.google_start, googleStartController);
