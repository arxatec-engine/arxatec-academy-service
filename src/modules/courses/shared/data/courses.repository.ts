import { prisma } from '@/config/prisma_client';
import type { Prisma } from '@/generated/client';
import {
  course_status,
  lesson_status,
  type course_level,
  type course_topic,
} from '@/generated/enums';
import type {
  CourseCatalogRecord,
  CourseDetailRecord,
  CourseLessonAggregate,
  CourseLevelCount,
  CourseTopicCount,
  LessonSummaryRecord,
} from '@/modules/courses/shared/domain/course.types';
import type {
  LessonLockedRecord,
  LessonUnlockedRecord,
} from '@/modules/courses/shared/domain/lesson.types';

const CATALOG_COURSE_SELECT = {
  id: true,
  slug: true,
  title: true,
  short_description: true,
  topic: true,
  level: true,
  cover_image_url: true, cover_image_key: true,
} as const;

const COURSE_DETAIL_SELECT = {
  teacher: { select: { full_name: true, biography: true, photo_url: true } },
  id: true,
  slug: true,
  title: true,
  long_description: true,
  topic: true,
  level: true,
  cover_image_url: true, cover_image_key: true,
  published_at: true,
} as const;

const LESSON_SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  type: true,
  position: true,
  duration_seconds: true,
  reading_minutes: true,
  is_free_sample: true,
} as const;

const LESSON_LOCKED_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  type: true,
  position: true,
  is_free_sample: true,
  duration_seconds: true,
  reading_minutes: true,
} as const;

const LESSON_RESOURCE_SELECT = {
  title: true,
  file_url: true, file_key: true,
  mime_type: true,
  size_bytes: true,
} as const;

const LESSON_UNLOCKED_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  type: true,
  position: true,
  is_free_sample: true,
  duration_seconds: true,
  reading_minutes: true,
  video_provider: true,
  video_external_id: true,
  article_body: true,
  transcript: true,
  updated_at: true,
  resources: { select: LESSON_RESOURCE_SELECT, orderBy: { position: 'asc' } },
} as const satisfies Prisma.lessonsSelect;

export interface CatalogFilters {
  topics: readonly course_topic[];
  levels: readonly course_level[];
}

const publishedCoursesWhere = ({ topics, levels }: CatalogFilters): Prisma.coursesWhereInput => {
  const where: Prisma.coursesWhereInput = { status: course_status.PUBLISHED };

  if (topics.length > 0) {
    where.topic = { in: [...topics] };
  }

  if (levels.length > 0) {
    where.level = { in: [...levels] };
  }

  return where;
};

export const findPublishedCourses = async (
  filters: CatalogFilters,
): Promise<readonly CourseCatalogRecord[]> =>
  prisma.courses.findMany({
    where: publishedCoursesWhere(filters),
    select: CATALOG_COURSE_SELECT,
    orderBy: { catalog_order: 'asc' },
  });

export const aggregatePublishedLessons = async (
  filters: CatalogFilters,
): Promise<readonly CourseLessonAggregate[]> => {
  const rows = await prisma.lessons.groupBy({
    by: ['course_id'],
    where: { status: lesson_status.PUBLISHED, course: publishedCoursesWhere(filters) },
    _count: { _all: true },
    _sum: { duration_seconds: true, reading_minutes: true },
  });

  return rows.map((row) => ({
    course_id: row.course_id,
    lesson_count: row._count._all,
    duration_seconds: row._sum.duration_seconds ?? 0,
    reading_minutes: row._sum.reading_minutes ?? 0,
  }));
};

export const countPublishedCoursesByTopic = async (
  levels: readonly course_level[],
): Promise<readonly CourseTopicCount[]> => {
  const rows = await prisma.courses.groupBy({
    by: ['topic'],
    where: publishedCoursesWhere({ topics: [], levels }),
    _count: { _all: true },
  });

  return rows.map((row) => ({ topic: row.topic, count: row._count._all }));
};

export const countPublishedCoursesByLevel = async (
  topics: readonly course_topic[],
): Promise<readonly CourseLevelCount[]> => {
  const rows = await prisma.courses.groupBy({
    by: ['level'],
    where: publishedCoursesWhere({ topics, levels: [] }),
    _count: { _all: true },
  });

  return rows.map((row) => ({ level: row.level, count: row._count._all }));
};

export const findPublishedCourseBySlug = async (slug: string): Promise<CourseDetailRecord | null> =>
  prisma.courses.findFirst({
    where: { slug, status: course_status.PUBLISHED },
    select: COURSE_DETAIL_SELECT,
  });

export const findPublishedLessonsByCourseId = async (
  course_id: string,
): Promise<readonly LessonSummaryRecord[]> =>
  prisma.lessons.findMany({
    where: { course_id, status: lesson_status.PUBLISHED },
    select: LESSON_SUMMARY_SELECT,
    orderBy: { position: 'asc' },
  });

export const findPublishedLessonLocked = async (
  course_id: string,
  slug: string,
): Promise<LessonLockedRecord | null> =>
  prisma.lessons.findFirst({
    where: { course_id, slug, status: lesson_status.PUBLISHED },
    select: LESSON_LOCKED_SELECT,
  });

export const findPublishedLessonUnlocked = async (
  course_id: string,
  slug: string,
): Promise<LessonUnlockedRecord | null> =>
  prisma.lessons.findFirst({
    where: { course_id, slug, status: lesson_status.PUBLISHED },
    select: LESSON_UNLOCKED_SELECT,
  });
