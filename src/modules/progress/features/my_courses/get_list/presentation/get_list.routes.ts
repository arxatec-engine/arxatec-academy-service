import { Router } from 'express';

import { ProgressEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { getMyCoursesController } from '@/modules/progress/features/my_courses/get_list/presentation/get_list.controller';

export const getMyCoursesRouter: Router = Router();

getMyCoursesRouter.get(ProgressEndpoints.my_courses, authenticateTokenJwt, getMyCoursesController);
