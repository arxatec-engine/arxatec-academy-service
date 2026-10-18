import { Router } from 'express';

import { AdminUsersPolicy } from '@/constants/admin_users';
import { AdminUsersEndpoints } from '@/constants/endpoints';
import { AdminUsersMessages } from '@/constants/messages/admin_users';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { createRateLimiter, userKey } from '@/middlewares/rate_limit';
import { requireAdmin } from '@/middlewares/require_admin';
import { listDirectoryController } from '@/modules/user/features/directory/presentation/directory.controller';
import { exportDirectoryController } from '@/modules/user/features/directory_export/presentation/directory_export.controller';

export const directoryRouter: Router = Router();
directoryRouter.use(authenticateTokenJwt, requireAdmin);
directoryRouter.get(AdminUsersEndpoints.export, createRateLimiter({
  definition: AdminUsersPolicy.export_rate_limit,
  description: AdminUsersMessages.export_rate_limit, keyBy: userKey,
}), exportDirectoryController);
directoryRouter.get(AdminUsersEndpoints.list, listDirectoryController);
