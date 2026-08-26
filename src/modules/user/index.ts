import { Router } from 'express';

import { MeRoutePrefix } from '@/constants/endpoints';
import { accountRouter } from '@/modules/user/features/account';
import { profileRouter } from '@/modules/user/features/profile';

export const userRouter: Router = Router();

userRouter.use(MeRoutePrefix, profileRouter);
userRouter.use(MeRoutePrefix, accountRouter);
