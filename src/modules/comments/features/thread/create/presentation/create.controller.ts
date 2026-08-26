import type { Request, Response } from 'express';

import { CommentRouteParams } from '@/constants/endpoints';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { createCommentSchema } from '@/modules/comments/features/thread/create/domain/create.schema';
import { createCommentService } from '@/modules/comments/features/thread/create/presentation/create.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';
import { readBodyField } from '@/utils/request_body';

export const createCommentController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = createCommentSchema.parse({
    user_id: authenticated_user.id,
    lesson_id: req.params[CommentRouteParams.lesson_id],
    body: readBodyField(req.body, 'body'),
  });
  const result = await createCommentService(payload);

  res.status(HttpStatusCodes.CREATED.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.CREATED,
      description: CommentMessages.thread.created,
      path: req.originalUrl,
      data: result,
    }),
  );
};
