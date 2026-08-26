import { Router } from 'express';

import { CommentEndpoints } from '@/constants/endpoints';
import { getCommentsController } from '@/modules/comments/features/thread/get_list/presentation/get_list.controller';

export const getCommentsRouter: Router = Router();

getCommentsRouter.get(CommentEndpoints.lesson_comments, getCommentsController);
