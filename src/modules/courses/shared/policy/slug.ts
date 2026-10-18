import { CoursePolicy } from '@/constants/courses';

export const normalizeSlug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, CoursePolicy.slug_max_length)
    .replace(/-$/, '');

export const slugCandidate = (base: string, suffix: number): string => {
  if (suffix === 1) {return base;}
  const ending = `-${suffix}`;
  return `${base.slice(0, CoursePolicy.slug_max_length - ending.length).replace(/-$/, '')}${ending}`;
};
