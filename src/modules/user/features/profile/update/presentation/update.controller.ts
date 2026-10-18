import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { updateProfileSchema } from '@/modules/user/features/profile/update/domain/update.schema';
import { updateProfileService } from '@/modules/user/features/profile/update/presentation/update.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';
import { readBodyField } from '@/utils/request_body';

export const updateProfileController = async (req: Request, res: Response): Promise<void> => {
  const authenticated_user = getAuthenticatedUser(req);
  const payload = updateProfileSchema.parse({
    user_id: authenticated_user.id,
    full_name: readBodyField(req.body, 'full_name'),
  });
  const result = await updateProfileService(payload);

  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: UserMessages.profile.updated,
      path: req.originalUrl,
      data: result,
    }),
  );
};
