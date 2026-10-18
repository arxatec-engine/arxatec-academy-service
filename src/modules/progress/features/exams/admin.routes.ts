import { Router } from 'express';
import { AdminCourseEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { requireAdmin } from '@/middlewares/require_admin';
import { getAdminExamController } from './admin_get/presentation/admin_get.controller';
import { updateAdminExamController } from './admin_update/presentation/admin_update.controller';

export const adminExamsRouter: Router = Router();
adminExamsRouter.use(authenticateTokenJwt, requireAdmin);
adminExamsRouter.get(AdminCourseEndpoints.exam, getAdminExamController);
adminExamsRouter.put(AdminCourseEndpoints.exam, updateAdminExamController);
