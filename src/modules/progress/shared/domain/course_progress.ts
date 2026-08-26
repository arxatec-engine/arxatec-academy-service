import type { LessonRefRecord } from '@/modules/courses/shared/domain/course_refs.types';
import type { CourseProgress } from '@/modules/progress/shared/domain/progress.types';
import { isCourseCompleted } from '@/modules/progress/shared/policy/completion';
import { resolveNextLesson } from '@/modules/progress/shared/policy/next_lesson';

export interface CourseProgressInput {
  lessons: readonly LessonRefRecord[];
  completed_lesson_ids: readonly string[];
}

export const summarizeCourseProgress = ({
  lessons,
  completed_lesson_ids,
}: CourseProgressInput): CourseProgress => {
  const completed = new Set(completed_lesson_ids);
  const completed_lessons = lessons.filter((lesson) => completed.has(lesson.id)).length;

  return {
    completed_lessons,
    lesson_count: lessons.length,
    next_lesson: resolveNextLesson(lessons, completed),
    is_completed: isCourseCompleted({
      published_lesson_count: lessons.length,
      completed_lesson_count: completed_lessons,
    }),
  };
};

export const groupLessonsByCourse = (
  lessons: readonly LessonRefRecord[],
): ReadonlyMap<string, readonly LessonRefRecord[]> => {
  const grouped = new Map<string, LessonRefRecord[]>();

  for (const lesson of lessons) {
    const current = grouped.get(lesson.course_id) ?? [];

    current.push(lesson);
    grouped.set(lesson.course_id, current);
  }

  return grouped;
};
