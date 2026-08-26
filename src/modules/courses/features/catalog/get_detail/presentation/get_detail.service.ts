import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import type { GetDetailPayload } from '@/modules/courses/features/catalog/get_detail/domain/get_detail.payload';
import type { GetDetailResult } from '@/modules/courses/features/catalog/get_detail/domain/get_detail.types';
import {
  findPublishedCourseBySlug,
  findPublishedLessonsByCourseId,
} from '@/modules/courses/shared/data/courses.repository';
import {
  toApiCourseDetail,
  toApiLessonSummary,
} from '@/modules/courses/shared/domain/course_mapper';
import { summarizeLessons } from '@/modules/courses/shared/domain/course_totals';
import { canViewLesson } from '@/modules/courses/shared/policy/lesson_access';
import { AppError } from '@/utils/errors';

export const getDetailService = async (payload: GetDetailPayload): Promise<GetDetailResult> => {
  const course = await findPublishedCourseBySlug(payload.slug);

  if (course === null) {
    throw new AppError(CourseMessages.course.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }

  const lessons = await findPublishedLessonsByCourseId(course.id);

  return {
    course: toApiCourseDetail(course, summarizeLessons(lessons)),
    lessons: lessons.map((lesson) =>
      toApiLessonSummary(
        lesson,
        canViewLesson({ is_free_sample: lesson.is_free_sample, has_session: payload.has_session }),
      ),
    ),
  };
};
