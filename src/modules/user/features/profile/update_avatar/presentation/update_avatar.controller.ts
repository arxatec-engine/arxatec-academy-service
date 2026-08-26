import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { updateAvatarSchema } from '@/modules/user/features/profile/update_avatar/domain/update_avatar.schema';
import { updateAvatarService } from '@/modules/user/features/profile/update_avatar/presentation/update_avatar.service';
import { requireUploadedFile } from '@/modules/user/features/profile/update_avatar/utils/uploaded_file';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const updateAvatarController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const file = requireUploadedFile(req);
  const payload = updateAvatarSchema.parse({
    user_id: authenticated_user.id,
    mime_type: file.mime_type,
    size_bytes: file.size_bytes,
  });
  const result = await updateAvatarService({ ...payload, content: file.content });

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: UserMessages.avatar.updated,
      path: req.originalUrl,
      data: result,
    }),
  );
};
