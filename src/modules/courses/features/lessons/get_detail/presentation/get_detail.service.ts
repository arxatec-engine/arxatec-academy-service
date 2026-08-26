import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import type { GetDetailPayload } from '@/modules/courses/features/lessons/get_detail/domain/get_detail.payload';
import type { GetDetailResult } from '@/modules/courses/features/lessons/get_detail/domain/get_detail.types';
import { resolveLessonNavigation } from '@/modules/courses/features/lessons/get_detail/domain/lesson_navigation';
import {
  findPublishedCourseBySlug,
  findPublishedLessonLocked,
  findPublishedLessonUnlocked,
  findPublishedLessonsByCourseId,
} from '@/modules/courses/shared/data/courses.repository';
import { toApiLessonSummary } from '@/modules/courses/shared/domain/course_mapper';
import {
  toApiLessonCourse,
  toApiLessonLocked,
  toApiLessonUnlocked,
} from '@/modules/courses/shared/domain/lesson_mapper';
import { canViewLesson } from '@/modules/courses/shared/policy/lesson_access';
import { AppError } from '@/utils/errors';

const lessonNotFound = (): AppError =>
  new AppError(CourseMessages.lesson.not_found, HttpStatusCodes.NOT_FOUND.code, {
    code: ErrorCodes.NOT_FOUND,
  });

export const getDetailService = async (payload: GetDetailPayload): Promise<GetDetailResult> => {
  const course = await findPublishedCourseBySlug(payload.course_slug);

  if (course === null) {
    throw new AppError(CourseMessages.course.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }

  const lessons = await findPublishedLessonsByCourseId(course.id);
  const index = lessons.findIndex((lesson) => lesson.slug === payload.lesson_slug);

  if (index === -1) {
    throw lessonNotFound();
  }

  const api_course = toApiLessonCourse(course, lessons.length);
  const has_access = canViewLesson({
    is_free_sample: lessons[index].is_free_sample,
    has_session: payload.has_session,
  });

  if (!has_access) {
    const locked = await findPublishedLessonLocked(course.id, payload.lesson_slug);

    if (locked === null) {
      throw lessonNotFound();
    }

    return {
      locked: true,
      view: {
        lesson: toApiLessonLocked(locked),
        course: api_course,
        lessons: lessons.map((lesson) =>
          toApiLessonSummary(
            lesson,
            canViewLesson({
              is_free_sample: lesson.is_free_sample,
              has_session: payload.has_session,
            }),
          ),
        ),
      },
    };
  }

  const unlocked = await findPublishedLessonUnlocked(course.id, payload.lesson_slug);

  if (unlocked === null) {
    throw lessonNotFound();
  }

  return {
    locked: false,
    view: {
      lesson: toApiLessonUnlocked(unlocked),
      course: api_course,
      navigation: resolveLessonNavigation(lessons, index),
    },
  };
};
