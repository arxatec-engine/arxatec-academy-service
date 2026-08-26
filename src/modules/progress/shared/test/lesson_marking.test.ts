import { canMarkLesson } from '@/modules/progress/shared/policy/lesson_marking';

const input = (overrides: Partial<Parameters<typeof canMarkLesson>[0]> = {}) => ({
  is_free_sample: false,
  has_session: true,
  is_lesson_published: true,
  is_course_published: true,
  ...overrides,
});

describe('canMarkLesson', () => {
  it('con sesión, una lección publicada de un curso publicado se puede marcar', () => {
    expect(canMarkLesson(input())).toBe(true);
  });

  it('sin sesión no se marca, ni siquiera la muestra gratuita del catálogo', () => {
    expect(canMarkLesson(input({ has_session: false }))).toBe(false);
  });

  it('sin sesión y con muestra gratuita, la regla de la fase 10 sigue mandando', () => {
    expect(canMarkLesson(input({ has_session: false, is_free_sample: true }))).toBe(true);
  });

  it('una lección en borrador no se puede marcar aunque haya sesión', () => {
    expect(canMarkLesson(input({ is_lesson_published: false }))).toBe(false);
  });

  it('una lección de un curso archivado no se puede marcar aunque haya sesión', () => {
    expect(canMarkLesson(input({ is_course_published: false }))).toBe(false);
  });
});
