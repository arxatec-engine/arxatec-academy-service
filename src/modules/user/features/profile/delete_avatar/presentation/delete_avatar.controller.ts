import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { deleteAvatarSchema } from '@/modules/user/features/profile/delete_avatar/domain/delete_avatar.schema';
import { deleteAvatarService } from '@/modules/user/features/profile/delete_avatar/presentation/delete_avatar.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const deleteAvatarController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = deleteAvatarSchema.parse({ user_id: authenticated_user.id });
  const result = await deleteAvatarService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: UserMessages.avatar.removed,
      path: req.originalUrl,
      data: result,
    }),
  );
};
