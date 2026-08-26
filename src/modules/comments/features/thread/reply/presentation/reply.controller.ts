import type { Request, Response } from 'express';

import { CommentRouteParams } from '@/constants/endpoints';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { replyCommentSchema } from '@/modules/comments/features/thread/reply/domain/reply.schema';
import { replyCommentService } from '@/modules/comments/features/thread/reply/presentation/reply.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';
import { readBodyField } from '@/utils/request_body';

export const replyCommentController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = replyCommentSchema.parse({
    user_id: authenticated_user.id,
    comment_id: req.params[CommentRouteParams.comment_id],
    body: readBodyField(req.body, 'body'),
  });
  const result = await replyCommentService(payload);

  res.status(HttpStatusCodes.CREATED.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.CREATED,
      description: CommentMessages.thread.replied,
      path: req.originalUrl,
      data: result,
    }),
  );
};
