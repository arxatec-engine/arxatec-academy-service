import type { Request, Response } from 'express';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ExamMessages } from '@/constants/messages/exams';
import { adminExamParamsSchema } from '../../domain/exam.params';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';
import { getAdminExamService } from './admin_get.service';

export const getAdminExamController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const { id } = adminExamParamsSchema.parse(req.params);
  const data = await getAdminExamService(id);
  res.setHeader('Cache-Control', 'no-store');
  res.json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: ExamMessages.found,
      path: req.originalUrl,
      data,
    }),
  );
};
