export const CoursePolicy = {
  title_max_length: 140,
  slug_max_length: 160,
  short_description_max_length: 140,
  lesson_title_max_length: 160,
  lesson_slug_max_length: 160,
  video_external_id_max_length: 64,
  resource_title_max_length: 160,
  first_position: 1,
  reading_words_per_minute: 200,
  min_published_lessons_to_publish: 1,
} as const;

export const LessonContentIssues = {
  video_fields_missing: 'VIDEO_FIELDS_MISSING',
  article_body_missing: 'ARTICLE_BODY_MISSING',
} as const;

export type LessonContentIssue = (typeof LessonContentIssues)[keyof typeof LessonContentIssues];

export const LessonPositionIssues = {
  not_contiguous: 'NOT_CONTIGUOUS',
  duplicated: 'DUPLICATED',
} as const;

export type LessonPositionIssue = (typeof LessonPositionIssues)[keyof typeof LessonPositionIssues];

export const SecondsPerMinute = 60;

export const CatalogPolicy = {
  search_max_length: 120,
  facet_total_key: 'ALL',
  multi_value_separator: ',',
} as const;

export type CatalogFacetTotalKey = typeof CatalogPolicy.facet_total_key;
