import type { Request, Response } from 'express';

import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { verifyEmailSchema } from '@/modules/auth/features/email_verification/verify/domain/verify.schema';
import { verifyEmailService } from '@/modules/auth/features/email_verification/verify/presentation/verify.service';
import { buildHttpResponse } from '@/utils/build_http_response';

export const verifyEmailController = async (req: Request, res: Response): Promise<void> => {
  const payload = verifyEmailSchema.parse(req.body);
  const result = await verifyEmailService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: result.already_verified
        ? AuthMessages.email_verification.already_verified
        : AuthMessages.email_verification.verified,
      path: req.originalUrl,
      meta: result.already_verified ? { code: ErrorCodes.EMAIL_ALREADY_VERIFIED } : undefined,
    }),
  );
};
