import type { Request, Response } from 'express';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ExamMessages } from '@/constants/messages/exams';
import { submitExamSchema } from '@/modules/progress/shared/domain/exam.schema';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';
import { courseExamParamsSchema } from '../../domain/exam.params';
import { submitCourseExamService } from './submit.service';

export const submitCourseExamController = async (req: Request, res: Response): Promise<void> => {
  const user = getAuthenticatedUser(req);
  const { slug } = courseExamParamsSchema.parse(req.params);
  const input = submitExamSchema.parse(req.body);
  const data = await submitCourseExamService(user.id, slug, input);
  res.setHeader('Cache-Control', 'no-store');
  res.json(
    buildHttpResponse({
      status: HttpStatusCodes.OK,
      description: ExamMessages.graded,
      path: req.originalUrl,
      data,
    }),
  );
};
