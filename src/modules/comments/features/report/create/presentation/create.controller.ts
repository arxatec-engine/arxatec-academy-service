import type { Request, Response } from 'express';

import { CommentRouteParams } from '@/constants/endpoints';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { createCommentReportSchema } from '@/modules/comments/features/report/create/domain/create.schema';
import { createCommentReportService } from '@/modules/comments/features/report/create/presentation/create.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';
import { readBodyField } from '@/utils/request_body';

export const createCommentReportController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = createCommentReportSchema.parse({
    user_id: authenticated_user.id,
    comment_id: req.params[CommentRouteParams.comment_id],
    reason: readBodyField(req.body, 'reason'),
  });

  await createCommentReportService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: CommentMessages.report.success,
      path: req.originalUrl,
    }),
  );
};
