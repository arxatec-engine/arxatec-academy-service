import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AdminUsersMessages } from '@/constants/messages/admin_users';
import { listDirectoryService } from '@/modules/user/features/directory/presentation/directory.service';
import { directoryPageSchema } from '@/modules/user/shared/domain/directory_filters.schema';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const listDirectoryController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const query = directoryPageSchema.parse(req.query);
  const result = await listDirectoryService(query);
  res.status(HttpStatusCodes.OK.code).json(buildHttpResponse({
    status: HttpStatusCodes.OK, description: AdminUsersMessages.listed,
    path: req.originalUrl, data: result.data, meta: { pagination: result.pagination },
  }));
};
