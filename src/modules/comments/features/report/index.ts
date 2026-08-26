import { Router } from 'express';

import { createCommentReportRouter } from '@/modules/comments/features/report/create/presentation/create.routes';

export const commentReportRouter: Router = Router();

commentReportRouter.use(createCommentReportRouter);
