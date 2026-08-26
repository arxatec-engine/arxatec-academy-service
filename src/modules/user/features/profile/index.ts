import { Router } from 'express';

import { deleteAvatarRouter } from '@/modules/user/features/profile/delete_avatar/presentation/delete_avatar.routes';
import { updateProfileRouter } from '@/modules/user/features/profile/update/presentation/update.routes';
import { updateAvatarRouter } from '@/modules/user/features/profile/update_avatar/presentation/update_avatar.routes';
import { updatePasswordRouter } from '@/modules/user/features/profile/update_password/presentation/update_password.routes';

export const profileRouter: Router = Router();

profileRouter.use(updateProfileRouter);
profileRouter.use(updatePasswordRouter);
profileRouter.use(updateAvatarRouter);
profileRouter.use(deleteAvatarRouter);
