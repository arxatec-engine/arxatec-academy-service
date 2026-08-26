import { Router } from 'express';

import { UserEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { updateProfileController } from '@/modules/user/features/profile/update/presentation/update.controller';

export const updateProfileRouter: Router = Router();

updateProfileRouter.patch(UserEndpoints.profile, authenticateTokenJwt, updateProfileController);
