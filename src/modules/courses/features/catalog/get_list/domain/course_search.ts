import { normalizeForSearch } from '@/modules/courses/features/catalog/get_list/utils/normalize_search';
import type { CourseCatalogRecord } from '@/modules/courses/shared/domain/course.types';

export const filterCoursesBySearch = (
  courses: readonly CourseCatalogRecord[],
  search: string | undefined,
): readonly CourseCatalogRecord[] => {
  if (search === undefined) {
    return courses;
  }

  const term = normalizeForSearch(search);

  if (term.length === 0) {
    return courses;
  }

  return courses.filter(
    (course) =>
      normalizeForSearch(course.title).includes(term) ||
      normalizeForSearch(course.short_description).includes(term),
  );
};
