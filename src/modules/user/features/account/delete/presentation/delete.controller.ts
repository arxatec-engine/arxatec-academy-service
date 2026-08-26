import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { deleteAccountSchema } from '@/modules/user/features/account/delete/domain/delete.schema';
import { deleteAccountService } from '@/modules/user/features/account/delete/presentation/delete.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { readBodyField } from '@/utils/request_body';

export const deleteAccountController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = deleteAccountSchema.parse({
    user_id: authenticated_user.id,
    password: readBodyField(req.body, 'password'),
  });

  await deleteAccountService(payload);

  res.status(HttpStatusCodes.NO_CONTENT.code).send();
};
