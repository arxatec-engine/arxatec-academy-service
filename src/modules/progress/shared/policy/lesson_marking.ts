import { canViewLesson } from '@/modules/courses/shared/policy/lesson_access';

export interface LessonMarkingInput {
  is_free_sample: boolean;
  has_session: boolean;
  is_lesson_published: boolean;
  is_course_published: boolean;
}

export const canMarkLesson = ({
  is_free_sample,
  has_session,
  is_lesson_published,
  is_course_published,
}: LessonMarkingInput): boolean =>
  is_lesson_published && is_course_published && canViewLesson({ is_free_sample, has_session });
