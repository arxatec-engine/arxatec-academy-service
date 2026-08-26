import { Router } from 'express';

import { UserEndpoints } from '@/constants/endpoints';
import { FileUsages } from '@/constants/files';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { createFileUpload } from '@/middlewares/file_upload';
import { updateAvatarController } from '@/modules/user/features/profile/update_avatar/presentation/update_avatar.controller';

export const updateAvatarRouter: Router = Router();

updateAvatarRouter.put(
  UserEndpoints.avatar,
  authenticateTokenJwt,
  createFileUpload(FileUsages.avatar),
  updateAvatarController,
);
