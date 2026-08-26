import type { Request, Response } from 'express';

import { ProgressRouteParams } from '@/constants/endpoints';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ProgressMessages } from '@/constants/messages/progress';
import { completeLessonSchema } from '@/modules/progress/features/lesson_progress/complete/domain/complete.schema';
import { completeLessonService } from '@/modules/progress/features/lesson_progress/complete/presentation/complete.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const completeLessonController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = completeLessonSchema.parse({
    user_id: authenticated_user.id,
    lesson_id: req.params[ProgressRouteParams.lesson_id],
    has_session: authenticated_user !== null,
  });
  const result = await completeLessonService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: ProgressMessages.lesson_progress.completed,
      path: req.originalUrl,
      data: result,
    }),
  );
};
