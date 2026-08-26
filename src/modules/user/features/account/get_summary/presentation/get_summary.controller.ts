import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { getSummarySchema } from '@/modules/user/features/account/get_summary/domain/get_summary.schema';
import { getSummaryService } from '@/modules/user/features/account/get_summary/presentation/get_summary.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const getSummaryController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = getSummarySchema.parse({ user_id: authenticated_user.id });
  const result = await getSummaryService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: UserMessages.summary.success,
      path: req.originalUrl,
      data: result,
    }),
  );
};
