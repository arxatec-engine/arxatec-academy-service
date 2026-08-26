import { isCourseCompleted, isEnrollmentFinished } from '@/modules/progress/shared/policy/completion';

describe('isCourseCompleted', () => {
  it('un curso sin lecciones publicadas nunca está terminado', () => {
    expect(isCourseCompleted({ published_lesson_count: 0, completed_lesson_count: 0 })).toBe(false);
  });

  it('con lecciones sin completar, no está terminado', () => {
    expect(isCourseCompleted({ published_lesson_count: 6, completed_lesson_count: 5 })).toBe(false);
  });

  it('con todas las publicadas completadas, está terminado', () => {
    expect(isCourseCompleted({ published_lesson_count: 6, completed_lesson_count: 6 })).toBe(true);
  });

  it('si se despublica una lección ya completada, sigue terminado', () => {
    expect(isCourseCompleted({ published_lesson_count: 5, completed_lesson_count: 6 })).toBe(true);
  });

  it('si se publica una séptima lección, deja de estar terminado', () => {
    expect(isCourseCompleted({ published_lesson_count: 7, completed_lesson_count: 6 })).toBe(false);
  });
});

describe('isEnrollmentFinished', () => {
  it('exige la fecha sellada y el curso completo', () => {
    const sealed = { completed_at: new Date('2026-07-03T00:00:00.000Z') };

    expect(isEnrollmentFinished(sealed, true)).toBe(true);
    expect(isEnrollmentFinished(sealed, false)).toBe(false);
    expect(isEnrollmentFinished({ completed_at: null }, true)).toBe(false);
  });
});
