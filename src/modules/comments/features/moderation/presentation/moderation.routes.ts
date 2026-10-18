import { Router } from 'express';

import { CommentRateLimits } from '@/constants/comments';
import { AdminCommentEndpoints } from '@/constants/endpoints';
import { CommentMessages } from '@/constants/messages/comments';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { createRateLimiter, userKey } from '@/middlewares/rate_limit';
import { requireAdmin } from '@/middlewares/require_admin';
import {
  deleteModerationController, getModerationCountsController, listModerationController,
  replyModerationController, updateModerationStatusController,
} from '@/modules/comments/features/moderation/presentation/moderation.controller';

export const moderationRouter: Router = Router();
moderationRouter.use(authenticateTokenJwt, requireAdmin);

const writeLimit = createRateLimiter({ definition: CommentRateLimits.moderation_write,
  description: CommentMessages.rate_limit.moderation, keyBy: userKey });
moderationRouter.get(AdminCommentEndpoints.list, listModerationController);
moderationRouter.get(AdminCommentEndpoints.counts, getModerationCountsController);
moderationRouter.post(AdminCommentEndpoints.replies, writeLimit, replyModerationController);
moderationRouter.patch(AdminCommentEndpoints.status, writeLimit, updateModerationStatusController);
moderationRouter.delete(AdminCommentEndpoints.detail, writeLimit, deleteModerationController);
