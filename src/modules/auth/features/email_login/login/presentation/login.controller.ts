import type { Request, Response } from 'express';

import { AuthHeaders } from '@/constants/auth';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { loginSchema } from '@/modules/auth/features/email_login/login/domain/login.schema';
import type { LoginRequestContext } from '@/modules/auth/features/email_login/login/domain/login.types';
import { loginService } from '@/modules/auth/features/email_login/login/presentation/login.service';
import { buildHttpResponse } from '@/utils/build_http_response';

const readRequestContext = (req: Request): LoginRequestContext => ({
  user_agent: req.headers[AuthHeaders.user_agent] ?? null,
  ip_address: req.ip ?? null,
});

export const loginController = async (req: Request, res: Response): Promise<void> => {
  const payload = loginSchema.parse(req.body);
  const result = await loginService({ payload, ...readRequestContext(req) });

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: AuthMessages.login.success,
      path: req.originalUrl,
      data: result,
    }),
  );
};
