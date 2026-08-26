import type { Request, Response } from 'express';

import { CourseRouteParams } from '@/constants/endpoints';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { getDetailSchema } from '@/modules/courses/features/catalog/get_detail/domain/get_detail.schema';
import { getDetailService } from '@/modules/courses/features/catalog/get_detail/presentation/get_detail.service';
import { getOptionalUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const getDetailController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getOptionalUser(req);
  const payload = getDetailSchema.parse({
    slug: req.params[CourseRouteParams.slug],
    has_session: authenticated_user !== null,
  });
  const result = await getDetailService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: CourseMessages.detail.success,
      path: req.originalUrl,
      data: result,
    }),
  );
};
