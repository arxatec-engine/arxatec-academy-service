import { Router } from 'express';

import { AdminCourseEndpoints, AdminLessonEndpoints, AdminVideoEndpoints } from '@/constants/endpoints';
import { FileUsages } from '@/constants/files';
import { AdminLessonMessages } from '@/constants/messages/admin_lessons';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { createFileUpload } from '@/middlewares/file_upload';
import { createRateLimiter, userKey } from '@/middlewares/rate_limit';
import { requireAdmin } from '@/middlewares/require_admin';
import {
  createAdminLessonController, createAdminResourceController, deleteAdminLessonController,
  deleteAdminResourceController, getAdminLessonController, listAdminLessonsController,
  probeAdminVideoController, publishAdminLessonController, reorderAdminLessonsController,
  reorderAdminResourcesController, unpublishAdminLessonController,
  updateAdminLessonController, updateAdminResourceController,
} from '@/modules/courses/features/admin_lessons/presentation/admin_lessons.controller';

export const adminCourseLessonsRouter: Router = Router();
adminCourseLessonsRouter.use(authenticateTokenJwt, requireAdmin);
adminCourseLessonsRouter.get(AdminCourseEndpoints.lessons, listAdminLessonsController);
adminCourseLessonsRouter.post(AdminCourseEndpoints.lessons, createAdminLessonController);
adminCourseLessonsRouter.put(AdminCourseEndpoints.lessons_order, reorderAdminLessonsController);

export const adminLessonsRouter: Router = Router();
adminLessonsRouter.use(authenticateTokenJwt, requireAdmin);
adminLessonsRouter.get(AdminLessonEndpoints.detail, getAdminLessonController);
adminLessonsRouter.patch(AdminLessonEndpoints.detail, updateAdminLessonController);
adminLessonsRouter.delete(AdminLessonEndpoints.detail, deleteAdminLessonController);
adminLessonsRouter.post(AdminLessonEndpoints.publish, publishAdminLessonController);
adminLessonsRouter.delete(AdminLessonEndpoints.publish, unpublishAdminLessonController);
adminLessonsRouter.post(AdminLessonEndpoints.resources,
  createFileUpload(FileUsages.lesson_resource), createAdminResourceController);
adminLessonsRouter.patch(AdminLessonEndpoints.resource, updateAdminResourceController);
adminLessonsRouter.delete(AdminLessonEndpoints.resource, deleteAdminResourceController);
adminLessonsRouter.put(AdminLessonEndpoints.resources_order, reorderAdminResourcesController);

export const adminVideoRouter: Router = Router();
adminVideoRouter.use(authenticateTokenJwt, requireAdmin);
adminVideoRouter.post(AdminVideoEndpoints.probe, createRateLimiter({
  definition: { max: 20, window_seconds: 3600 }, description: AdminLessonMessages.video_rate_limit,
  keyBy: userKey,
}), probeAdminVideoController);
