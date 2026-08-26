import type { Request, Response } from 'express';

import { AuthHeaders } from '@/constants/auth';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { googleExchangeSchema } from '@/modules/auth/features/google_login/exchange/domain/exchange.schema';
import { exchangeGoogleCode } from '@/modules/auth/features/google_login/exchange/presentation/exchange.service';
import { buildHttpResponse } from '@/utils/build_http_response';

export const googleExchangeController = async (req: Request, res: Response): Promise<void> => {
  const payload = googleExchangeSchema.parse(req.body);

  const session = await exchangeGoogleCode({
    code: payload.code,
    user_agent: req.get(AuthHeaders.user_agent) ?? null,
    ip_address: req.ip ?? null,
  });

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: AuthMessages.google.exchange_success,
      path: req.originalUrl,
      data: session,
    }),
  );
};
