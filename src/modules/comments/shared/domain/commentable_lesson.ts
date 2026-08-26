import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { course_status, lesson_status } from '@/generated/enums';
import { findLessonWithCourseById } from '@/modules/courses/shared/data/course_refs.repository';
import { AppError } from '@/utils/errors';

export interface CommentableLesson {
  id: string;
}

export const requireCommentableLesson = async (lesson_id: string): Promise<CommentableLesson> => {
  const lesson = await findLessonWithCourseById(lesson_id);

  if (
    lesson === null ||
    lesson.status !== lesson_status.PUBLISHED ||
    lesson.course.status !== course_status.PUBLISHED
  ) {
    throw new AppError(CourseMessages.lesson.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }

  return { id: lesson.id };
};
