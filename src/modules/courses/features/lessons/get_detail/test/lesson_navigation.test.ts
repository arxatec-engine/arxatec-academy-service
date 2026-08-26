import { lesson_type } from '@/generated/enums';
import { resolveLessonNavigation } from '@/modules/courses/features/lessons/get_detail/domain/lesson_navigation';
import type { LessonSummaryRecord } from '@/modules/courses/shared/domain/course.types';

const PUBLISHED = [
  { slug: 'leccion-1', title: 'Lección 1' },
  { slug: 'leccion-2', title: 'Lección 2' },
  { slug: 'leccion-3', title: 'Lección 3' },
];

describe('resolveLessonNavigation', () => {
  it('en el medio, apunta a la anterior y a la siguiente', () => {
    expect(resolveLessonNavigation(PUBLISHED, 1)).toEqual({
      previous: { slug: 'leccion-1', title: 'Lección 1' },
      next: { slug: 'leccion-3', title: 'Lección 3' },
    });
  });

  it('en la primera lección, previous es null', () => {
    expect(resolveLessonNavigation(PUBLISHED, 0)).toEqual({
      previous: null,
      next: { slug: 'leccion-2', title: 'Lección 2' },
    });
  });

  it('en la última lección, next es null', () => {
    expect(resolveLessonNavigation(PUBLISHED, 2)).toEqual({
      previous: { slug: 'leccion-2', title: 'Lección 2' },
      next: null,
    });
  });

  it('un curso de una sola lección no tiene ni anterior ni siguiente', () => {
    expect(resolveLessonNavigation([PUBLISHED[0]], 0)).toEqual({ previous: null, next: null });
  });

  it('salta la lección en borrador: la siguiente de la 3 es la 5, no un hueco', () => {
    const sin_la_cuatro = [
      { slug: 'leccion-3', title: 'Lección 3' },
      { slug: 'leccion-5', title: 'Lección 5' },
    ];

    expect(resolveLessonNavigation(sin_la_cuatro, 0).next).toEqual({
      slug: 'leccion-5',
      title: 'Lección 5',
    });
  });

  it('del vecino solo copia slug y título, aunque el registro traiga más campos', () => {
    const temario: readonly LessonSummaryRecord[] = [
      {
        slug: 'leccion-1',
        title: 'Lección 1',
        description: 'La primera',
        type: lesson_type.VIDEO,
        position: 1,
        duration_seconds: 480,
        reading_minutes: null,
        is_free_sample: true,
      },
      {
        slug: 'leccion-2',
        title: 'Lección 2',
        description: 'La segunda',
        type: lesson_type.ARTICLE,
        position: 2,
        duration_seconds: null,
        reading_minutes: 2,
        is_free_sample: false,
      },
    ];

    expect(resolveLessonNavigation(temario, 0).next).toEqual({
      slug: 'leccion-2',
      title: 'Lección 2',
    });
  });

  it('un índice fuera de la lista no inventa vecinos', () => {
    expect(resolveLessonNavigation(PUBLISHED, -1)).toEqual({ previous: null, next: null });
    expect(resolveLessonNavigation(PUBLISHED, 3)).toEqual({ previous: null, next: null });
  });
});
