import type { Request, Response } from 'express';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ExamMessages } from '@/constants/messages/exams';
import { saveExamSchema } from '@/modules/progress/shared/domain/exam.schema';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';
import { adminExamParamsSchema } from '../../domain/exam.params';
import { updateAdminExamService } from './admin_update.service';

export const updateAdminExamController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const { id } = adminExamParamsSchema.parse(req.params);
  const input = saveExamSchema.parse(req.body);
  const data = await updateAdminExamService(id, input);
  res.setHeader('Cache-Control', 'no-store');
  res.json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: ExamMessages.saved,
      path: req.originalUrl,
      data,
    }),
  );
};
