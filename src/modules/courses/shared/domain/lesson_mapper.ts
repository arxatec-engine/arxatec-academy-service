import type { CourseDetailRecord } from '@/modules/courses/shared/domain/course.types';
import type {
  ApiLessonCourse,
  ApiLessonLocked,
  ApiLessonResource,
  ApiLessonUnlocked,
  ApiLessonVideo,
  LessonLockedRecord,
  LessonResourceRecord,
  LessonUnlockedRecord,
} from '@/modules/courses/shared/domain/lesson.types';

const toApiLessonVideo = (lesson: LessonUnlockedRecord): ApiLessonVideo | null =>
  lesson.video_provider === null || lesson.video_external_id === null
    ? null
    : { provider: lesson.video_provider, external_id: lesson.video_external_id };

export const toApiLessonResource = (resource: LessonResourceRecord): ApiLessonResource => ({
  title: resource.title,
  file_url: resource.file_url,
  mime_type: resource.mime_type,
  size_bytes: resource.size_bytes,
});

export const toApiLessonLocked = (lesson: LessonLockedRecord): ApiLessonLocked => ({
  slug: lesson.slug,
  title: lesson.title,
  description: lesson.description,
  type: lesson.type,
  position: lesson.position,
  is_free_sample: lesson.is_free_sample,
  duration_seconds: lesson.duration_seconds,
  reading_minutes: lesson.reading_minutes,
});

export const toApiLessonUnlocked = (lesson: LessonUnlockedRecord): ApiLessonUnlocked => ({
  slug: lesson.slug,
  title: lesson.title,
  description: lesson.description,
  type: lesson.type,
  position: lesson.position,
  is_free_sample: lesson.is_free_sample,
  duration_seconds: lesson.duration_seconds,
  video: toApiLessonVideo(lesson),
  article_body: lesson.article_body,
  reading_minutes: lesson.reading_minutes,
  transcript: lesson.transcript,
  resources: lesson.resources.map(toApiLessonResource),
  updated_at: lesson.updated_at.toISOString(),
});

export const toApiLessonCourse = (
  course: Pick<CourseDetailRecord, 'slug' | 'title'>,
  lesson_count: number,
): ApiLessonCourse => ({
  slug: course.slug,
  title: course.title,
  lesson_count,
});
