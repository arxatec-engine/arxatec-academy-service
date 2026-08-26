import type { LessonRefRecord } from '@/modules/courses/shared/domain/course_refs.types';
import {
  groupLessonsByCourse,
  summarizeCourseProgress,
} from '@/modules/progress/shared/domain/course_progress';

const lessonAt = (position: number, course_id = 'crs_1'): LessonRefRecord => ({
  id: `${course_id}_les_${String(position)}`,
  course_id,
  slug: `leccion-${String(position)}`,
  title: `Lección ${String(position)}`,
  position,
});

const LESSONS: readonly LessonRefRecord[] = [lessonAt(1), lessonAt(2), lessonAt(3)];

describe('summarizeCourseProgress', () => {
  it('cuenta las completadas y apunta a la primera que falta', () => {
    const progress = summarizeCourseProgress({
      lessons: LESSONS,
      completed_lesson_ids: ['crs_1_les_1', 'crs_1_les_3'],
    });

    expect(progress).toMatchObject({
      completed_lessons: 2,
      lesson_count: 3,
      is_completed: false,
    });
    expect(progress.next_lesson?.id).toBe('crs_1_les_2');
  });

  it('ignora las lecciones completadas que ya no están publicadas', () => {
    const progress = summarizeCourseProgress({
      lessons: LESSONS,
      completed_lesson_ids: ['crs_1_les_1', 'crs_1_les_9'],
    });

    expect(progress.completed_lessons).toBe(1);
  });

  it('con todo completado no hay siguiente y el curso está terminado', () => {
    const progress = summarizeCourseProgress({
      lessons: LESSONS,
      completed_lesson_ids: ['crs_1_les_1', 'crs_1_les_2', 'crs_1_les_3'],
    });

    expect(progress.next_lesson).toBeNull();
    expect(progress.is_completed).toBe(true);
  });

  it('un curso sin lecciones publicadas no está terminado', () => {
    expect(summarizeCourseProgress({ lessons: [], completed_lesson_ids: [] })).toMatchObject({
      completed_lessons: 0,
      lesson_count: 0,
      next_lesson: null,
      is_completed: false,
    });
  });
});

describe('groupLessonsByCourse', () => {
  it('agrupa por curso conservando el orden de entrada', () => {
    const grouped = groupLessonsByCourse([
      lessonAt(1),
      lessonAt(1, 'crs_2'),
      lessonAt(2),
      lessonAt(2, 'crs_2'),
    ]);

    expect(grouped.get('crs_1')?.map((lesson) => lesson.position)).toEqual([1, 2]);
    expect(grouped.get('crs_2')?.map((lesson) => lesson.position)).toEqual([1, 2]);
    expect(grouped.get('crs_3')).toBeUndefined();
  });
});
