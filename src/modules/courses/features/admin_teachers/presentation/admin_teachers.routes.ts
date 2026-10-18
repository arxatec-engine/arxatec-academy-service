import { Router } from 'express';

import { AdminTeacherEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { requireAdmin } from '@/middlewares/require_admin';
import { listAdminTeachersController } from '@/modules/courses/features/admin_teachers/presentation/admin_teachers.controller';

export const adminTeachersRouter: Router = Router();
adminTeachersRouter.use(authenticateTokenJwt, requireAdmin);
adminTeachersRouter.get(AdminTeacherEndpoints.list, listAdminTeachersController);
