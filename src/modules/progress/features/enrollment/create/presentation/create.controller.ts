import type { Request, Response } from 'express';

import { ProgressRouteParams } from '@/constants/endpoints';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ProgressMessages } from '@/constants/messages/progress';
import { createEnrollmentSchema } from '@/modules/progress/features/enrollment/create/domain/create.schema';
import { createEnrollmentService } from '@/modules/progress/features/enrollment/create/presentation/create.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const createEnrollmentController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = createEnrollmentSchema.parse({
    user_id: authenticated_user.id,
    slug: req.params[ProgressRouteParams.slug],
  });
  const result = await createEnrollmentService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: ProgressMessages.enrollment.success,
      path: req.originalUrl,
      data: result,
    }),
  );
};
