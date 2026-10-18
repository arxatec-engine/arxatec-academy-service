import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ErrorCodes } from '@/constants/error_codes';
import { ExamPolicy } from '@/constants/exams';
import { CourseMessages } from '@/constants/messages/courses';
import { findPublishedCourseBySlug } from '@/modules/courses/shared/data/courses.repository';
import { findCourseExam, readExamProgress } from '@/modules/progress/shared/data/exams.repository';
import { examQuestionsSchema } from '@/modules/progress/shared/domain/exam.schema';
import type { CourseExamView } from '@/modules/progress/shared/domain/exam.types';
import { AppError } from '@/utils/errors';

export const getCourseExamService = async (
  user_id: string,
  slug: string,
): Promise<{ exam: CourseExamView }> => {
  const course = await findPublishedCourseBySlug(slug);
  if (!course) {
    throw new AppError(CourseMessages.course.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }
  const [exam, progress] = await Promise.all([
    findCourseExam(course.id),
    readExamProgress(user_id, course.id),
  ]);
  const certificate_id = progress.enrollment?.certificate?.id ?? null;
  const last_result = certificate_id
    ? (progress.enrollment?.certificate?.exam_attempt ?? null)
    : progress.latest;
  const passing_score = exam?.passing_score ?? ExamPolicy.passing_score;
  const status = certificate_id
    ? 'passed'
    : !exam?.enabled
      ? 'unavailable'
      : progress.ready
        ? 'ready'
        : 'locked';
  return {
    exam: {
      course: { slug: course.slug, title: course.title },
      status,
      version: exam?.version ?? null,
      question_count: ExamPolicy.question_count,
      passing_score,
      questions:
        status === 'ready' && exam
          ? examQuestionsSchema
              .parse(exam.questions)
              .map(({ text, options }) => ({ text, options }))
          : [],
      certificate_id,
      last_result: last_result
        ? {
            score: last_result.score,
            passed: last_result.passed,
            passing_score: last_result.passing_score,
            question_count: ExamPolicy.question_count,
            certificate_id,
          }
        : null,
    },
  };
};
