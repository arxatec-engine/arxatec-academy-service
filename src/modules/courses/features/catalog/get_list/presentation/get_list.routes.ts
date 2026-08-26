import { Router } from 'express';

import { CourseEndpoints } from '@/constants/endpoints';
import { getListController } from '@/modules/courses/features/catalog/get_list/presentation/get_list.controller';

export const getListRouter: Router = Router();

getListRouter.get(CourseEndpoints.list, getListController);
