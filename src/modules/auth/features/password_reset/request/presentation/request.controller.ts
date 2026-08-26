import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { requestPasswordResetSchema } from '@/modules/auth/features/password_reset/request/domain/request.schema';
import { requestPasswordReset } from '@/modules/auth/features/password_reset/request/presentation/request.service';
import { buildHttpResponse } from '@/utils/build_http_response';

export const requestPasswordResetController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const payload = requestPasswordResetSchema.parse(req.body);

  await requestPasswordReset(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: AuthMessages.password_forgot.success,
      path: req.originalUrl,
    }),
  );
};
