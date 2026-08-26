import { Router } from 'express';

import { CommentEndpoints } from '@/constants/endpoints';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { commentRateLimit } from '@/middlewares/rate_limit';
import { requireVerifiedEmail } from '@/middlewares/require_verified_email';
import { replyCommentController } from '@/modules/comments/features/thread/reply/presentation/reply.controller';

export const replyCommentRouter: Router = Router();

replyCommentRouter.post(
  CommentEndpoints.replies,
  authenticateTokenJwt,
  requireVerifiedEmail,
  commentRateLimit,
  replyCommentController,
);
