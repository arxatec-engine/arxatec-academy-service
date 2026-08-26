import { Router } from 'express';

import { catalogRouter } from '@/modules/courses/features/catalog';
import { lessonsRouter } from '@/modules/courses/features/lessons';

export const coursesRouter: Router = Router();

coursesRouter.use(catalogRouter);
coursesRouter.use(lessonsRouter);
