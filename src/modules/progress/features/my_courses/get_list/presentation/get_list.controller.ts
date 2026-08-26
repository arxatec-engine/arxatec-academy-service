import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ProgressMessages } from '@/constants/messages/progress';
import { getMyCoursesSchema } from '@/modules/progress/features/my_courses/get_list/domain/get_list.schema';
import { getMyCoursesService } from '@/modules/progress/features/my_courses/get_list/presentation/get_list.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const getMyCoursesController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = getMyCoursesSchema.parse({ user_id: authenticated_user.id });
  const result = await getMyCoursesService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: ProgressMessages.my_courses.success,
      path: req.originalUrl,
      data: result,
    }),
  );
};
