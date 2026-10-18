import type { CatalogFacetTotalKey } from '@/constants/courses';
import type { course_level, course_topic, lesson_type } from '@/generated/enums';
import type { TeacherProfile } from '@/modules/courses/shared/domain/teacher.types';

export interface CourseCatalogRecord {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  topic: course_topic;
  level: course_level;
  cover_image_url: string | null;
}

export interface CourseDetailRecord {
  teacher: TeacherProfile | null;
  id: string;
  slug: string;
  title: string;
  long_description: string;
  topic: course_topic;
  level: course_level;
  cover_image_url: string | null;
  published_at: Date | null;
}

export interface LessonSummaryRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: lesson_type;
  position: number;
  duration_seconds: number | null;
  reading_minutes: number | null;
  is_free_sample: boolean;
}

export interface CourseLessonAggregate {
  course_id: string;
  lesson_count: number;
  duration_seconds: number;
  reading_minutes: number;
}

export interface CourseTotals {
  lesson_count: number;
  total_duration_seconds: number;
}

export interface CourseContentTotals extends CourseTotals {
  video_count: number;
  article_count: number;
}

export interface CourseTopicCount {
  topic: course_topic;
  count: number;
}

export interface CourseLevelCount {
  level: course_level;
  count: number;
}

export type CourseTopicFacets = Record<course_topic | CatalogFacetTotalKey, number>;

export type CourseLevelFacets = Record<course_level, number>;

export interface CourseFacets {
  topic: CourseTopicFacets;
  level: CourseLevelFacets;
}

export interface ApiCatalogCourse {
  slug: string;
  title: string;
  short_description: string;
  topic: course_topic;
  level: course_level;
  cover_image_url: string | null;
  lesson_count: number;
  total_duration_seconds: number;
}

export interface ApiCourseDetail {
  teacher: TeacherProfile | null;
  slug: string;
  title: string;
  long_description: string;
  topic: course_topic;
  level: course_level;
  cover_image_url: string | null;
  lesson_count: number;
  video_count: number;
  article_count: number;
  total_duration_seconds: number;
  published_at: string | null;
}

export interface ApiLessonSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: lesson_type;
  position: number;
  duration_seconds: number | null;
  reading_minutes: number | null;
  is_free_sample: boolean;
  is_unlocked: boolean;
}
