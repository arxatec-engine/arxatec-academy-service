import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { resetPasswordSchema } from '@/modules/auth/features/password_reset/reset/domain/reset.schema';
import { resetPassword } from '@/modules/auth/features/password_reset/reset/presentation/reset.service';
import { buildHttpResponse } from '@/utils/build_http_response';

export const resetPasswordController = async (req: Request, res: Response): Promise<void> => {
  const payload = resetPasswordSchema.parse(req.body);

  await resetPassword(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: AuthMessages.password_reset.success,
      path: req.originalUrl,
    }),
  );
};
