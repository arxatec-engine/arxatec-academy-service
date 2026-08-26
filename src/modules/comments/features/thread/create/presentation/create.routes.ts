import { Router } from 'express';

import { CommentEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { commentRateLimit } from '@/middlewares/rate_limit';
import { requireVerifiedEmail } from '@/middlewares/require_verified_email';
import { createCommentController } from '@/modules/comments/features/thread/create/presentation/create.controller';

export const createCommentRouter: Router = Router();

createCommentRouter.post(
  CommentEndpoints.lesson_comments,
  authenticateTokenJwt,
  requireVerifiedEmail,
  commentRateLimit,
  createCommentController,
);
