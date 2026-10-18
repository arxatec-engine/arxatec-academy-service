import { Router } from 'express';

import { AdminCourseEndpoints } from '@/constants/endpoints';
import { AdminCoursePolicy } from '@/constants/courses';
import { FileUsages } from '@/constants/files';
import { AdminCourseMessages } from '@/constants/messages/admin_courses';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { createFileUpload } from '@/middlewares/file_upload';
import { createRateLimiter, userKey } from '@/middlewares/rate_limit';
import { requireAdmin } from '@/middlewares/require_admin';
import {
  archiveAdminCourseController, createAdminCourseController, duplicateAdminCourseController,
  getAdminCourseController, listAdminCoursesController, publishAdminCourseController,
  reorderAdminCoursesController, unpublishAdminCourseController,
  updateAdminCourseController, updateAdminCourseCoverController,
} from '@/modules/courses/features/admin_courses/presentation/admin_courses.controller';

export const adminCoursesRouter: Router = Router();
adminCoursesRouter.use(authenticateTokenJwt, requireAdmin);

const autosaveLimit = createRateLimiter({
  definition: { window_seconds: 60, max: AdminCoursePolicy.autosave_per_minute },
  description: AdminCourseMessages.autosave_rate_limit,
  keyBy: userKey,
});

adminCoursesRouter.get(AdminCourseEndpoints.list, listAdminCoursesController);
adminCoursesRouter.post(AdminCourseEndpoints.list, createAdminCourseController);
adminCoursesRouter.put(AdminCourseEndpoints.order, reorderAdminCoursesController);
adminCoursesRouter.get(AdminCourseEndpoints.detail, getAdminCourseController);
adminCoursesRouter.patch(AdminCourseEndpoints.detail, autosaveLimit, updateAdminCourseController);
adminCoursesRouter.post(AdminCourseEndpoints.publish, publishAdminCourseController);
adminCoursesRouter.post(AdminCourseEndpoints.unpublish, unpublishAdminCourseController);
adminCoursesRouter.post(AdminCourseEndpoints.duplicate, duplicateAdminCourseController);
adminCoursesRouter.post(AdminCourseEndpoints.archive, archiveAdminCourseController);
adminCoursesRouter.put(AdminCourseEndpoints.cover,
  createFileUpload(FileUsages.course_cover), updateAdminCourseCoverController);
