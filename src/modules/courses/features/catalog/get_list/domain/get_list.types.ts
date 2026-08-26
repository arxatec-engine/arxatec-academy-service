import type { ApiCatalogCourse, CourseFacets } from '@/modules/courses/shared/domain/course.types';

export interface GetListResult {
  courses: readonly ApiCatalogCourse[];
  facets: CourseFacets;
}
