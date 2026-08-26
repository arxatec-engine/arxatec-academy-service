import { CatalogPolicy } from '@/constants/courses';
import { course_level, course_topic } from '@/generated/enums';
import type {
  CourseFacets,
  CourseLevelCount,
  CourseLevelFacets,
  CourseTopicCount,
  CourseTopicFacets,
} from '@/modules/courses/shared/domain/course.types';

export interface CourseFacetCounts {
  topic_counts: readonly CourseTopicCount[];
  level_counts: readonly CourseLevelCount[];
}

const emptyTopicFacets = (): CourseTopicFacets => ({
  [CatalogPolicy.facet_total_key]: 0,
  [course_topic.FIRST_STEPS]: 0,
  [course_topic.LEGAL_ENGINEERING]: 0,
  [course_topic.APPLIED_AI]: 0,
  [course_topic.ARXATEC_PRODUCT]: 0,
});

const emptyLevelFacets = (): CourseLevelFacets => ({
  [course_level.INTRODUCTORY]: 0,
  [course_level.INTERMEDIATE]: 0,
});

export const buildCourseFacets = ({
  topic_counts,
  level_counts,
}: CourseFacetCounts): CourseFacets => {
  const topic = emptyTopicFacets();
  const level = emptyLevelFacets();

  for (const row of topic_counts) {
    topic[row.topic] = row.count;
    topic[CatalogPolicy.facet_total_key] += row.count;
  }

  for (const row of level_counts) {
    level[row.level] = row.count;
  }

  return { topic, level };
};
