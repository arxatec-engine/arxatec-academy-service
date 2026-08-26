import type { Request, Response } from 'express';

import { ProgressRouteParams } from '@/constants/endpoints';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ProgressMessages } from '@/constants/messages/progress';
import { updateLessonProgressSchema } from '@/modules/progress/features/lesson_progress/update/domain/update.schema';
import { updateLessonProgressService } from '@/modules/progress/features/lesson_progress/update/presentation/update.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';
import { readBodyField } from '@/utils/request_body';

export const updateLessonProgressController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const body: unknown = req.body;
  const payload = updateLessonProgressSchema.parse({
    user_id: authenticated_user.id,
    lesson_id: req.params[ProgressRouteParams.lesson_id],
    has_session: authenticated_user !== null,
    last_position_seconds: readBodyField(body, 'last_position_seconds'),
    completed: readBodyField(body, 'completed'),
  });
  const result = await updateLessonProgressService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: ProgressMessages.lesson_progress.success,
      path: req.originalUrl,
      data: result,
    }),
  );
};
