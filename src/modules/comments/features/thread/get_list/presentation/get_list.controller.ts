import type { Request, Response } from 'express';

import { CommentRouteParams } from '@/constants/endpoints';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { getCommentsSchema } from '@/modules/comments/features/thread/get_list/domain/get_list.schema';
import { getCommentsService } from '@/modules/comments/features/thread/get_list/presentation/get_list.service';
import { buildHttpResponse } from '@/utils/build_http_response';

export const getCommentsController = async (req: Request, res: Response): Promise<void> => {
  const payload = getCommentsSchema.parse({
    lesson_id: req.params[CommentRouteParams.lesson_id],
  });
  const result = await getCommentsService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: CommentMessages.thread.list_success,
      path: req.originalUrl,
      data: result,
    }),
  );
};
