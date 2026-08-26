import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { ProgressMessages } from '@/constants/messages/progress';
import { course_status, lesson_status } from '@/generated/enums';
import { findLessonWithCourseById } from '@/modules/courses/shared/data/course_refs.repository';
import type { LessonCourseRecord } from '@/modules/courses/shared/domain/course_refs.types';
import { canMarkLesson } from '@/modules/progress/shared/policy/lesson_marking';
import { AppError } from '@/utils/errors';

export interface MarkableLessonInput {
  lesson_id: string;
  has_session: boolean;
}

export interface MarkableLesson {
  id: string;
  course: LessonCourseRecord;
}

export const requireMarkableLesson = async ({
  lesson_id,
  has_session,
}: MarkableLessonInput): Promise<MarkableLesson> => {
  const lesson = await findLessonWithCourseById(lesson_id);

  if (lesson === null) {
    throw new AppError(CourseMessages.lesson.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }

  const can_mark = canMarkLesson({
    is_free_sample: lesson.is_free_sample,
    has_session,
    is_lesson_published: lesson.status === lesson_status.PUBLISHED,
    is_course_published: lesson.course.status === course_status.PUBLISHED,
  });

  if (!can_mark) {
    throw new AppError(ProgressMessages.lesson_progress.locked, HttpStatusCodes.FORBIDDEN.code, {
      code: ErrorCodes.LESSON_LOCKED,
    });
  }

  return { id: lesson.id, course: lesson.course };
};
