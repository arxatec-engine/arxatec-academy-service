import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ErrorCodes } from '@/constants/error_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { ExamMessages } from '@/constants/messages/exams';
import { findPublishedCourseBySlug } from '@/modules/courses/shared/data/courses.repository';
import { submitCourseExam } from '@/modules/progress/shared/data/exams.repository';
import type { SubmitExamInput } from '@/modules/progress/shared/domain/exam.schema';
import { AppError } from '@/utils/errors';

export const submitCourseExamService = async (
  user_id: string,
  slug: string,
  input: SubmitExamInput,
) => {
  const course = await findPublishedCourseBySlug(slug);
  if (!course) {
    throw new AppError(CourseMessages.course.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }
  const outcome = await submitCourseExam(user_id, course.id, input);
  if (outcome.state === 'not_found') {
    throw new AppError(CourseMessages.course.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }
  if (outcome.state === 'unavailable') {
    throw new AppError(ExamMessages.unavailable, HttpStatusCodes.CONFLICT.code, {
      code: ErrorCodes.EXAM_UNAVAILABLE,
    });
  }
  if (outcome.state === 'locked') {
    throw new AppError(ExamMessages.locked, HttpStatusCodes.FORBIDDEN.code, {
      code: ErrorCodes.EXAM_LOCKED,
    });
  }
  if (outcome.state === 'stale') {
    throw new AppError(ExamMessages.stale, HttpStatusCodes.CONFLICT.code, {
      code: ErrorCodes.EXAM_CHANGED,
    });
  }
  if (outcome.state === 'graded') {
    return { result: outcome.result };
  }
  throw new Error('Unexpected exam submission outcome');
};
