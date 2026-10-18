import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ErrorCodes } from '@/constants/error_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { findAdminCourse } from '@/modules/courses/shared/data/admin_courses.repository';
import { findCourseExam } from '@/modules/progress/shared/data/exams.repository';
import { examQuestionsSchema } from '@/modules/progress/shared/domain/exam.schema';
import type { AdminExam } from '@/modules/progress/shared/domain/exam.types';
import { AppError } from '@/utils/errors';

export const getAdminExamService = async (
  course_id: string,
): Promise<{ exam: AdminExam | null }> => {
  if (!(await findAdminCourse(course_id))) {
    throw new AppError(CourseMessages.course.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }
  const exam = await findCourseExam(course_id);
  return {
    exam: exam
      ? {
          version: exam.version,
          enabled: exam.enabled,
          passing_score: exam.passing_score,
          questions: examQuestionsSchema.parse(exam.questions),
          updated_at: exam.updated_at.toISOString(),
        }
      : null,
  };
};
