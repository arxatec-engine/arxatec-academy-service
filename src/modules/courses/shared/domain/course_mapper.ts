import type {
  ApiCatalogCourse,
  ApiCourseDetail,
  ApiLessonSummary,
  CourseCatalogRecord,
  CourseContentTotals,
  CourseDetailRecord,
  CourseTotals,
  LessonSummaryRecord,
} from '@/modules/courses/shared/domain/course.types';

export const toApiCatalogCourse = (
  course: CourseCatalogRecord,
  totals: CourseTotals,
): ApiCatalogCourse => ({
  slug: course.slug,
  title: course.title,
  short_description: course.short_description,
  topic: course.topic,
  level: course.level,
  cover_image_url: course.cover_image_url,
  lesson_count: totals.lesson_count,
  total_duration_seconds: totals.total_duration_seconds,
});

export const toApiCourseDetail = (
  course: CourseDetailRecord,
  totals: CourseContentTotals,
): ApiCourseDetail => ({
  slug: course.slug,
  title: course.title,
  long_description: course.long_description,
  topic: course.topic,
  level: course.level,
  cover_image_url: course.cover_image_url,
  lesson_count: totals.lesson_count,
  video_count: totals.video_count,
  article_count: totals.article_count,
  total_duration_seconds: totals.total_duration_seconds,
  published_at: course.published_at === null ? null : course.published_at.toISOString(),
});

export const toApiLessonSummary = (
  lesson: LessonSummaryRecord,
  is_unlocked: boolean,
): ApiLessonSummary => ({
  slug: lesson.slug,
  title: lesson.title,
  description: lesson.description,
  type: lesson.type,
  position: lesson.position,
  duration_seconds: lesson.duration_seconds,
  reading_minutes: lesson.reading_minutes,
  is_free_sample: lesson.is_free_sample,
  is_unlocked,
});
