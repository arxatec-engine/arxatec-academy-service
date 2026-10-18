import { teacherSchema } from '@/modules/courses/shared/domain/teacher.schema';

const profile = {
  full_name: '  Ana Pérez  ',
  biography: '  Docente de tecnología jurídica.  ',
  photo_url: 'https://example.test/ana.jpg',
};

describe('teacherSchema', () => {
  it('acepta los tres datos del docente y normaliza los textos', () => {
    expect(teacherSchema.parse(profile)).toEqual({
      ...profile,
      full_name: 'Ana Pérez',
      biography: 'Docente de tecnología jurídica.',
    });
    expect(teacherSchema.parse({ ...profile, photo_url: null }).photo_url).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,test',
    'file:///tmp/photo.jpg',
    'ftp://example.test/photo.jpg',
  ])('rechaza una URL de foto fuera de HTTP(S): %s', (photo_url) => {
    expect(teacherSchema.safeParse({ ...profile, photo_url }).success).toBe(false);
  });

  it('exige nombre y biografía y limita su tamaño', () => {
    for (const change of [
      { full_name: ' ' },
      { biography: ' ' },
      { full_name: 'a'.repeat(121) },
      { biography: 'a'.repeat(2001) },
    ]) {
      expect(teacherSchema.safeParse({ ...profile, ...change }).success).toBe(false);
    }
  });
});
