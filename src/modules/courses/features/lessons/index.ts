import { Router } from 'express';

import { getDetailRouter } from '@/modules/courses/features/lessons/get_detail/presentation/get_detail.routes';

export const lessonsRouter: Router = Router();

lessonsRouter.use(getDetailRouter);
