import { Router } from 'express';

import { CertificatesRoutePrefix, CoursesRoutePrefix, LessonsRoutePrefix, MeRoutePrefix } from '@/constants/endpoints';
import { certificatesRouter } from '@/modules/progress/features/certificates';
import { examsRouter } from '@/modules/progress/features/exams';
import { enrollmentRouter } from '@/modules/progress/features/enrollment';
import { lessonProgressRouter } from '@/modules/progress/features/lesson_progress';
import { myCoursesRouter } from '@/modules/progress/features/my_courses';

export const progressRouter: Router = Router();

progressRouter.use(CoursesRoutePrefix, enrollmentRouter);
progressRouter.use(CoursesRoutePrefix, examsRouter);
progressRouter.use(LessonsRoutePrefix, lessonProgressRouter);
progressRouter.use(MeRoutePrefix, myCoursesRouter);
progressRouter.use(CertificatesRoutePrefix, certificatesRouter);
