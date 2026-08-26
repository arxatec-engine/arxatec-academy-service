import type { LessonRefRecord } from '@/modules/courses/shared/domain/course_refs.types';

export const resolveNextLesson = (
  lessons: readonly LessonRefRecord[],
  completed_lesson_ids: ReadonlySet<string>,
): LessonRefRecord | null =>
  lessons.find((lesson) => !completed_lesson_ids.has(lesson.id)) ?? null;
