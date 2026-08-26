import { Router } from 'express';

import { CoursesRoutePrefix, LessonsRoutePrefix, MeRoutePrefix } from '@/constants/endpoints';
import { enrollmentRouter } from '@/modules/progress/features/enrollment';
import { lessonProgressRouter } from '@/modules/progress/features/lesson_progress';
import { myCoursesRouter } from '@/modules/progress/features/my_courses';

export const progressRouter: Router = Router();

progressRouter.use(CoursesRoutePrefix, enrollmentRouter);
progressRouter.use(LessonsRoutePrefix, lessonProgressRouter);
progressRouter.use(MeRoutePrefix, myCoursesRouter);
