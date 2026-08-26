import { Router } from 'express';

import { createCommentRouter } from '@/modules/comments/features/thread/create/presentation/create.routes';
import { getCommentsRouter } from '@/modules/comments/features/thread/get_list/presentation/get_list.routes';
import { replyCommentRouter } from '@/modules/comments/features/thread/reply/presentation/reply.routes';

export const lessonThreadRouter: Router = Router();

lessonThreadRouter.use(getCommentsRouter);
lessonThreadRouter.use(createCommentRouter);

export const commentThreadRouter: Router = Router();

commentThreadRouter.use(replyCommentRouter);
