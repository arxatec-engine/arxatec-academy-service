import { Router } from 'express';
import { ExamEndpoints } from '@/constants/endpoints';
import { ExamPolicy } from '@/constants/exams';
import { ExamMessages } from '@/constants/messages/exams';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { createRateLimiter, userKey } from '@/middlewares/rate_limit';
import { getCourseExamController } from './get_detail/presentation/get_detail.controller';
import { submitCourseExamController } from './submit/presentation/submit.controller';

export const examsRouter: Router = Router();
examsRouter.get(ExamEndpoints.detail, authenticateTokenJwt, getCourseExamController);
examsRouter.post(
  ExamEndpoints.submit,
  authenticateTokenJwt,
  createRateLimiter({
    definition: ExamPolicy.submissions,
    description: ExamMessages.rate_limit,
    keyBy: userKey,
  }),
  submitCourseExamController,
);
