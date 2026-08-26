import { Router } from 'express';

import { CommentsRoutePrefix, LessonsRoutePrefix } from '@/constants/endpoints';
import { commentReportRouter } from '@/modules/comments/features/report';
import { commentThreadRouter, lessonThreadRouter } from '@/modules/comments/features/thread';

export const commentsRouter: Router = Router();

commentsRouter.use(LessonsRoutePrefix, lessonThreadRouter);
commentsRouter.use(CommentsRoutePrefix, commentThreadRouter);
commentsRouter.use(CommentsRoutePrefix, commentReportRouter);
