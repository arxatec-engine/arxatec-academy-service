import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { updatePasswordSchema } from '@/modules/user/features/profile/update_password/domain/update_password.schema';
import { updatePasswordService } from '@/modules/user/features/profile/update_password/presentation/update_password.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';
import { readBodyField } from '@/utils/request_body';

export const updatePasswordController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = updatePasswordSchema.parse({
    user_id: authenticated_user.id,
    session_id: authenticated_user.session_id,
    current_password: readBodyField(req.body, 'current_password'),
    new_password: readBodyField(req.body, 'new_password'),
  });

  await updatePasswordService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: UserMessages.password.updated,
      path: req.originalUrl,
    }),
  );
};
