import { Router } from 'express';

import { ApiPrefix, AuthRoutePrefix, CoursesRoutePrefix } from '@/constants/endpoints';
import { authRouter } from '@/modules/auth';
import { commentsRouter } from '@/modules/comments';
import { coursesRouter } from '@/modules/courses';
import { progressRouter } from '@/modules/progress';
import { userRouter } from '@/modules/user';

export const routes: Router = Router();

routes.use(`${ApiPrefix}${AuthRoutePrefix}`, authRouter);
routes.use(`${ApiPrefix}${CoursesRoutePrefix}`, coursesRouter);
routes.use(ApiPrefix, progressRouter);
routes.use(ApiPrefix, commentsRouter);
routes.use(ApiPrefix, userRouter);
