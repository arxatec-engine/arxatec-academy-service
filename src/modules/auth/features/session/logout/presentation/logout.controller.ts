import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { logoutSchema } from '@/modules/auth/features/session/logout/domain/logout.schema';
import { logoutService } from '@/modules/auth/features/session/logout/presentation/logout.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const logoutController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = logoutSchema.parse({ session_id: authenticated_user.session_id });
  const result = await logoutService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: result.already_revoked
        ? AuthMessages.logout.already_revoked
        : AuthMessages.logout.success,
      path: req.originalUrl,
    }),
  );
};
