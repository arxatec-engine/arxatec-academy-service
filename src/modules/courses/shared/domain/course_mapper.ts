import type { FileUrlResolver } from '@/infrastructure/storage/storage.types';
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
  resolveFileUrl: FileUrlResolver,
): ApiCatalogCourse => ({
  slug: course.slug,
  title: course.title,
  short_description: course.short_description,
  topic: course.topic,
  level: course.level,
  cover_image_url: resolveFileUrl(course.cover_image_url, course.cover_image_key),
  lesson_count: totals.lesson_count,
  total_duration_seconds: totals.total_duration_seconds,
});

export const toApiCourseDetail = (
  course: CourseDetailRecord,
  totals: CourseContentTotals,
  resolveFileUrl: FileUrlResolver,
): ApiCourseDetail => ({
  teacher: course.teacher
    ? {
        full_name: course.teacher.full_name,
        biography: course.teacher.biography,
        photo_url: course.teacher.photo_url,
      }
    : null,
  slug: course.slug,
  title: course.title,
  long_description: course.long_description,
  topic: course.topic,
  level: course.level,
  cover_image_url: resolveFileUrl(course.cover_image_url, course.cover_image_key),
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
  id: lesson.id,
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
