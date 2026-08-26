import { LessonPositionIssues } from '@/constants/courses';
import { canPublishCourse } from '@/modules/courses/shared/policy/course_publication_policy';
import {
  resequenceLessonPositions,
  validateLessonPositions,
} from '@/modules/courses/shared/policy/lesson_position_policy';

describe('validateLessonPositions', () => {
  it('acepta una secuencia sin huecos desde 1, en cualquier orden de llegada', () => {
    expect(validateLessonPositions([1, 2, 3, 4, 5, 6])).toEqual({ valid: true });
    expect(validateLessonPositions([3, 1, 2])).toEqual({ valid: true });
    expect(validateLessonPositions([])).toEqual({ valid: true });
  });

  it('rechaza un hueco y rechaza empezar en cero', () => {
    expect(validateLessonPositions([1, 2, 4])).toEqual({
      valid: false,
      issue: LessonPositionIssues.not_contiguous,
    });

    expect(validateLessonPositions([0, 1, 2])).toEqual({
      valid: false,
      issue: LessonPositionIssues.not_contiguous,
    });
  });

  it('rechaza posiciones repetidas', () => {
    expect(validateLessonPositions([1, 2, 2])).toEqual({
      valid: false,
      issue: LessonPositionIssues.duplicated,
    });
  });
});

describe('resequenceLessonPositions', () => {
  it('reescribe el bloque entero desde 1 en el orden recibido', () => {
    expect(resequenceLessonPositions(['les_c', 'les_a', 'les_b'])).toEqual([
      { id: 'les_c', position: 1 },
      { id: 'les_a', position: 2 },
      { id: 'les_b', position: 3 },
    ]);
  });
});

describe('canPublishCourse', () => {
  it('un curso sin lecciones publicadas no se puede publicar', () => {
    expect(canPublishCourse({ published_lesson_count: 0 })).toBe(false);
  });

  it('con una leccion publicada ya se puede', () => {
    expect(canPublishCourse({ published_lesson_count: 1 })).toBe(true);
  });
});
