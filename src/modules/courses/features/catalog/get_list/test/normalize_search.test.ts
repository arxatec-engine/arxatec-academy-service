import { normalizeForSearch } from '@/modules/courses/features/catalog/get_list/utils/normalize_search';

describe('normalizeForSearch', () => {
  it('quita acentos, baja a minúsculas y colapsa los espacios', () => {
    expect(normalizeForSearch('  IA  Aplicada a la PRÁCTICA legal ')).toBe(
      'ia aplicada a la practica legal',
    );
  });

  it('normaliza la ñ a n, para que "diseno" encuentre "Diseño"', () => {
    expect(normalizeForSearch('Diseño')).toBe('diseno');
  });
});
