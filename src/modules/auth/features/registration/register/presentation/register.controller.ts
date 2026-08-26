import type { Request, Response } from 'express';

import { AuthHeaders } from '@/constants/auth';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { registerSchema } from '@/modules/auth/features/registration/register/domain/register.schema';
import { registerUser } from '@/modules/auth/features/registration/register/presentation/register.service';
import { buildHttpResponse } from '@/utils/build_http_response';

export const registerController = async (req: Request, res: Response): Promise<void> => {
  const payload = registerSchema.parse(req.body);

  const session = await registerUser({
    ...payload,
    user_agent: req.get(AuthHeaders.user_agent) ?? null,
    ip_address: req.ip ?? null,
  });

  res.status(HttpStatusCodes.CREATED.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.CREATED,
      description: AuthMessages.register.created,
      path: req.originalUrl,
      data: session,
    }),
  );
};
