import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { getListSchema } from '@/modules/courses/features/catalog/get_list/domain/get_list.schema';
import { getListService } from '@/modules/courses/features/catalog/get_list/presentation/get_list.service';
import { buildHttpResponse } from '@/utils/build_http_response';

export const getListController = async (req: Request, res: Response): Promise<void> => {
  const payload = getListSchema.parse(req.query);
  const result = await getListService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: CourseMessages.catalog.success,
      path: req.originalUrl,
      data: result,
    }),
  );
};
