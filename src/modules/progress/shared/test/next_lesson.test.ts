import type { LessonRefRecord } from '@/modules/courses/shared/domain/course_refs.types';
import { resolveNextLesson } from '@/modules/progress/shared/policy/next_lesson';

const lessonAt = (position: number): LessonRefRecord => ({
  id: `les_${String(position)}`,
  course_id: 'crs_1',
  slug: `leccion-${String(position)}`,
  title: `Lección ${String(position)}`,
  position,
});

const LESSONS: readonly LessonRefRecord[] = [lessonAt(1), lessonAt(2), lessonAt(3), lessonAt(4)];

describe('resolveNextLesson', () => {
  it('sin nada completado, la siguiente es la primera', () => {
    expect(resolveNextLesson(LESSONS, new Set())?.id).toBe('les_1');
  });

  it('es la primera NO completada, no la siguiente en orden', () => {
    expect(resolveNextLesson(LESSONS, new Set(['les_1', 'les_3']))?.id).toBe('les_2');
  });

  it('con las primeras completadas, sigue por el hueco siguiente', () => {
    expect(resolveNextLesson(LESSONS, new Set(['les_1', 'les_2']))?.id).toBe('les_3');
  });

  it('con todas completadas, no hay siguiente', () => {
    expect(resolveNextLesson(LESSONS, new Set(['les_1', 'les_2', 'les_3', 'les_4']))).toBeNull();
  });

  it('un curso sin lecciones publicadas no tiene siguiente', () => {
    expect(resolveNextLesson([], new Set())).toBeNull();
  });
});
