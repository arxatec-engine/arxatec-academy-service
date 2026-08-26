import { Router } from 'express';

import { UserEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { updatePasswordController } from '@/modules/user/features/profile/update_password/presentation/update_password.controller';

export const updatePasswordRouter: Router = Router();

updatePasswordRouter.patch(UserEndpoints.password, authenticateTokenJwt, updatePasswordController);
