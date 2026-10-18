export const normalizeForSearch = (value: string): string => value.normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
