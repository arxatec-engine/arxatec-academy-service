import { Router } from 'express';

import { UserEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { deleteAccountController } from '@/modules/user/features/account/delete/presentation/delete.controller';

export const deleteAccountRouter: Router = Router();

deleteAccountRouter.delete(UserEndpoints.account, authenticateTokenJwt, deleteAccountController);
