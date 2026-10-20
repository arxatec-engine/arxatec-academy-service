import { resolveStoredFileUrl } from '@/infrastructure/storage/file_url';
import { buildCourseFacets } from '@/modules/courses/features/catalog/get_list/domain/catalog_facets';
import { filterCoursesBySearch } from '@/modules/courses/features/catalog/get_list/domain/course_search';
import type { GetListPayload } from '@/modules/courses/features/catalog/get_list/domain/get_list.payload';
import type { GetListResult } from '@/modules/courses/features/catalog/get_list/domain/get_list.types';
import {
  aggregatePublishedLessons,
  countPublishedCoursesByLevel,
  countPublishedCoursesByTopic,
  findPublishedCourses,
  type CatalogFilters,
} from '@/modules/courses/shared/data/courses.repository';
import { toApiCatalogCourse } from '@/modules/courses/shared/domain/course_mapper';
import { toCourseTotals } from '@/modules/courses/shared/domain/course_totals';

export const getListService = async (payload: GetListPayload): Promise<GetListResult> => {
  const filters: CatalogFilters = { topics: payload.topic, levels: payload.level };

  const [courses, aggregates, topic_counts, level_counts] = await Promise.all([
    findPublishedCourses(filters),
    aggregatePublishedLessons(filters),
    countPublishedCoursesByTopic(payload.level),
    countPublishedCoursesByLevel(payload.topic),
  ]);

  const aggregate_by_course = new Map(
    aggregates.map((aggregate) => [aggregate.course_id, aggregate]),
  );

  return {
    courses: filterCoursesBySearch(courses, payload.search).map((course) =>
      toApiCatalogCourse(course, toCourseTotals(aggregate_by_course.get(course.id)), resolveStoredFileUrl),
    ),
    facets: buildCourseFacets({ topic_counts, level_counts }),
  };
};
