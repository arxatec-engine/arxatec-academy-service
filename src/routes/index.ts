import { Router } from 'express';

import { AdminCommentsRoutePrefix, AdminCourseRoutePrefix, AdminLessonRoutePrefix, AdminRoutePrefix, AdminTeacherRoutePrefix, ApiPrefix, AuthRoutePrefix, CoursesRoutePrefix, NotificationsRoutePrefix } from '@/constants/endpoints';
import { authRouter } from '@/modules/auth';
import { commentsRouter } from '@/modules/comments';
import { moderationRouter } from '@/modules/comments/features/moderation/presentation/moderation.routes';
import { coursesRouter } from '@/modules/courses';
import { adminCoursesRouter } from '@/modules/courses/features/admin_courses';
import { adminTeachersRouter } from '@/modules/courses/features/admin_teachers/presentation/admin_teachers.routes';
import { adminCourseLessonsRouter, adminLessonsRouter, adminVideoRouter } from '@/modules/courses/features/admin_lessons/presentation/admin_lessons.routes';
import { progressRouter } from '@/modules/progress';
import { adminExamsRouter } from '@/modules/progress/features/exams/admin.routes';
import { adminNotificationsRouter, notificationsRouter } from '@/modules/notifications/presentation/notifications.routes';
import { userRouter } from '@/modules/user';
import { directoryRouter } from '@/modules/user/features/directory/presentation/directory.routes';

export const routes: Router = Router();

// API payloads can contain temporary, user-authorized CloudFront URLs.
routes.use(ApiPrefix, (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

routes.use(`${ApiPrefix}${AuthRoutePrefix}`, authRouter);
routes.use(`${ApiPrefix}${CoursesRoutePrefix}`, coursesRouter);
routes.use(`${ApiPrefix}${AdminRoutePrefix}${AdminCourseRoutePrefix}`, adminCoursesRouter);
routes.use(`${ApiPrefix}${AdminRoutePrefix}${AdminTeacherRoutePrefix}`, adminTeachersRouter);
routes.use(`${ApiPrefix}${AdminRoutePrefix}${AdminCourseRoutePrefix}`, adminExamsRouter);
routes.use(`${ApiPrefix}${AdminRoutePrefix}${AdminCourseRoutePrefix}`, adminCourseLessonsRouter);
routes.use(`${ApiPrefix}${AdminRoutePrefix}${AdminLessonRoutePrefix}`, adminLessonsRouter);
routes.use(`${ApiPrefix}${AdminRoutePrefix}`, adminVideoRouter);
routes.use(`${ApiPrefix}${AdminRoutePrefix}${AdminCommentsRoutePrefix}`, moderationRouter);
routes.use(`${ApiPrefix}${AdminRoutePrefix}`, directoryRouter);
routes.use(`${ApiPrefix}${NotificationsRoutePrefix}`, notificationsRouter);
routes.use(`${ApiPrefix}${AdminRoutePrefix}${NotificationsRoutePrefix}`, adminNotificationsRouter);
routes.use(ApiPrefix, progressRouter);
routes.use(ApiPrefix, commentsRouter);
routes.use(ApiPrefix, userRouter);
