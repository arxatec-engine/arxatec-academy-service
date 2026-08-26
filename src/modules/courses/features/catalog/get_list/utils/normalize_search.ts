const DIACRITICS = /\p{Diacritic}/gu;
const WHITESPACE = /\s+/g;

export const normalizeForSearch = (value: string): string =>
  value.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim().replace(WHITESPACE, ' ');
