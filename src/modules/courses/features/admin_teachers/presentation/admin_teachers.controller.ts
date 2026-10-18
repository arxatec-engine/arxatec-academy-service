import type { Request, Response } from 'express';

import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AdminCourseMessages } from '@/constants/messages/admin_courses';
import { listAdminTeachersService } from '@/modules/courses/features/admin_teachers/presentation/admin_teachers.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

export const listAdminTeachersController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const data = await listAdminTeachersService();
  res.status(HttpStatusCodes.OK.code).json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: AdminCourseMessages.teachers_listed,
      path: req.originalUrl,
      data,
    }),
  );
};
