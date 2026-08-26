import { Router } from 'express';

import { CourseEndpoints } from '@/constants/endpoints';
import { optionalAuthenticate } from '@/middlewares/optional_authenticate';
import { getDetailController } from '@/modules/courses/features/lessons/get_detail/presentation/get_detail.controller';

export const getDetailRouter: Router = Router();

getDetailRouter.get(CourseEndpoints.lesson_detail, optionalAuthenticate, getDetailController);
