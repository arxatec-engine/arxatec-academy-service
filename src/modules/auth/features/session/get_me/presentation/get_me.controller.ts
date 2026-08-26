import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { getMeSchema } from '@/modules/auth/features/session/get_me/domain/get_me.schema';
import { getMeService } from '@/modules/auth/features/session/get_me/presentation/get_me.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const getMeController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = getMeSchema.parse({ user_id: authenticated_user.id });
  const result = await getMeService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: AuthMessages.me.success,
      path: req.originalUrl,
      data: result,
    }),
  );
};
