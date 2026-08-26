import { canViewLesson } from '@/modules/courses/shared/policy/lesson_access';

describe('canViewLesson · los cuatro cruces de la tabla de acceso', () => {
  it('visitante sin cuenta + muestra gratuita → ve la lección', () => {
    expect(canViewLesson({ is_free_sample: true, has_session: false })).toBe(true);
  });

  it('visitante sin cuenta + lección normal → no la ve', () => {
    expect(canViewLesson({ is_free_sample: false, has_session: false })).toBe(false);
  });

  it('con sesión + muestra gratuita → ve la lección', () => {
    expect(canViewLesson({ is_free_sample: true, has_session: true })).toBe(true);
  });

  it('con sesión + lección normal → ve la lección', () => {
    expect(canViewLesson({ is_free_sample: false, has_session: true })).toBe(true);
  });
});
