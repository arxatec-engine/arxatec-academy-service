import { Router } from 'express';

import { UserEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { deleteAvatarController } from '@/modules/user/features/profile/delete_avatar/presentation/delete_avatar.controller';

export const deleteAvatarRouter: Router = Router();

deleteAvatarRouter.delete(UserEndpoints.avatar, authenticateTokenJwt, deleteAvatarController);
