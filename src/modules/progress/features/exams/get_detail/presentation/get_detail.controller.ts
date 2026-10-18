import type { Request, Response } from 'express';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ExamMessages } from '@/constants/messages/exams';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';
import { courseExamParamsSchema } from '../../domain/exam.params';
import { getCourseExamService } from './get_detail.service';

export const getCourseExamController = async (req: Request, res: Response): Promise<void> => {
  const user = getAuthenticatedUser(req);
  const { slug } = courseExamParamsSchema.parse(req.params);
  const data = await getCourseExamService(user.id, slug);
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
