import type { Request, Response } from 'express';

import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { resendVerificationSchema } from '@/modules/auth/features/email_verification/resend/domain/resend.schema';
import { resendVerificationService } from '@/modules/auth/features/email_verification/resend/presentation/resend.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const resendVerificationController = async (req: Request, res: Response): Promise<void> => {
  const user = getAuthenticatedUser(req);

  resendVerificationSchema.parse(req.body);

  const result = await resendVerificationService({
    user_id: user.id,
    email: user.email,
    email_verified_at: user.email_verified_at,
  });

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: result.already_verified
        ? AuthMessages.email_verification.already_verified
        : AuthMessages.email_verification.resend_success,
      path: req.originalUrl,
      data: { retry_after_seconds: result.retry_after_seconds },
      meta: result.already_verified ? { code: ErrorCodes.EMAIL_ALREADY_VERIFIED } : undefined,
    }),
  );
};
