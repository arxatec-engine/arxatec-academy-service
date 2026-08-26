import { Router } from 'express';

import { getMyCoursesRouter } from '@/modules/progress/features/my_courses/get_list/presentation/get_list.routes';

export const myCoursesRouter: Router = Router();

myCoursesRouter.use(getMyCoursesRouter);
