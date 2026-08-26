import { Router } from 'express';

import { CommentEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { createCommentReportController } from '@/modules/comments/features/report/create/presentation/create.controller';

export const createCommentReportRouter: Router = Router();

createCommentReportRouter.post(
  CommentEndpoints.report,
  authenticateTokenJwt,
  createCommentReportController,
);
