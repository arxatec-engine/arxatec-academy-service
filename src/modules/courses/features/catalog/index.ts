import { Router } from 'express';

import { getDetailRouter } from '@/modules/courses/features/catalog/get_detail/presentation/get_detail.routes';
import { getListRouter } from '@/modules/courses/features/catalog/get_list/presentation/get_list.routes';

export const catalogRouter: Router = Router();

catalogRouter.use(getListRouter);
catalogRouter.use(getDetailRouter);
