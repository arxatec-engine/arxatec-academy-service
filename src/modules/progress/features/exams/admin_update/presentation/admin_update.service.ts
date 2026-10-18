import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ErrorCodes } from '@/constants/error_codes';
import { ExamMessages } from '@/constants/messages/exams';
import { saveCourseExam } from '@/modules/progress/shared/data/exams.repository';
import type { SaveExamInput } from '@/modules/progress/shared/domain/exam.schema';
import { AppError } from '@/utils/errors';
import { getAdminExamService } from '../../admin_get/presentation/admin_get.service';

export const updateAdminExamService = async (course_id: string, input: SaveExamInput) => {
  await getAdminExamService(course_id);
  const result = await saveCourseExam(course_id, input);
  if (result.state === 'stale') {
    throw new AppError(ExamMessages.stale, HttpStatusCodes.CONFLICT.code, {
      code: ErrorCodes.EXAM_CHANGED,
    });
  }
  if (result.state === 'archived') {
    throw new AppError(ExamMessages.unavailable, HttpStatusCodes.CONFLICT.code, {
      code: ErrorCodes.INVALID_STATE_TRANSITION,
    });
  }
  return {
    exam: {
      version: result.exam.version,
      enabled: result.exam.enabled,
      passing_score: result.exam.passing_score,
      questions: input.questions,
      updated_at: result.exam.updated_at.toISOString(),
    },
  };
};
