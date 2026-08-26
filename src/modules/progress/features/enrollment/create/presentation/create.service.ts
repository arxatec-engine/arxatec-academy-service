import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { findPublishedLessonRefsByCourseIds } from '@/modules/courses/shared/data/course_refs.repository';
import { findPublishedCourseBySlug } from '@/modules/courses/shared/data/courses.repository';
import type { CreateEnrollmentPayload } from '@/modules/progress/features/enrollment/create/domain/create.payload';
import type { CreateEnrollmentResult } from '@/modules/progress/features/enrollment/create/domain/create.types';
import {
  enrollInCourse,
  findCompletedLessonIds,
} from '@/modules/progress/shared/data/progress.repository';
import { summarizeCourseProgress } from '@/modules/progress/shared/domain/course_progress';
import { toApiEnrollment } from '@/modules/progress/shared/domain/progress_mapper';
import { AppError } from '@/utils/errors';

export const createEnrollmentService = async (
  payload: CreateEnrollmentPayload,
): Promise<CreateEnrollmentResult> => {
  const course = await findPublishedCourseBySlug(payload.slug);

  if (course === null) {
    throw new AppError(CourseMessages.course.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }

  const lessons = await findPublishedLessonRefsByCourseIds([course.id]);
  const enrollment = await enrollInCourse({ user_id: payload.user_id, course_id: course.id });
  const completed_lesson_ids = await findCompletedLessonIds(
    payload.user_id,
    lessons.map((lesson) => lesson.id),
  );

  return {
    enrollment: toApiEnrollment(
      course,
      enrollment,
      summarizeCourseProgress({ lessons, completed_lesson_ids }),
    ),
  };
};
