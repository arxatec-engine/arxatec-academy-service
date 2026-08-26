import { prisma } from '@/config/prisma_client';
import type { Prisma } from '@/generated/client';
import { course_status, lesson_status } from '@/generated/enums';
import type {
  CourseRefRecord,
  LessonRefRecord,
  LessonWithCourseRecord,
} from '@/modules/courses/shared/domain/course_refs.types';

const COURSE_REF_SELECT = {
  id: true,
  slug: true,
  title: true,
} as const;

const LESSON_REF_SELECT = {
  id: true,
  course_id: true,
  slug: true,
  title: true,
  position: true,
} as const;

const LESSON_WITH_COURSE_SELECT = {
  id: true,
  slug: true,
  title: true,
  is_free_sample: true,
  status: true,
  course: { select: { id: true, slug: true, title: true, status: true } },
} as const satisfies Prisma.lessonsSelect;

export const findPublishedCoursesByIds = async (
  course_ids: readonly string[],
): Promise<readonly CourseRefRecord[]> =>
  prisma.courses.findMany({
    where: { id: { in: [...course_ids] }, status: course_status.PUBLISHED },
    select: COURSE_REF_SELECT,
    orderBy: { catalog_order: 'asc' },
  });

export const findPublishedLessonRefsByCourseIds = async (
  course_ids: readonly string[],
): Promise<readonly LessonRefRecord[]> =>
  prisma.lessons.findMany({
    where: { course_id: { in: [...course_ids] }, status: lesson_status.PUBLISHED },
    select: LESSON_REF_SELECT,
    orderBy: [{ course_id: 'asc' }, { position: 'asc' }],
  });

export const findLessonWithCourseById = async (
  lesson_id: string,
): Promise<LessonWithCourseRecord | null> =>
  prisma.lessons.findUnique({
    where: { id: lesson_id },
    select: LESSON_WITH_COURSE_SELECT,
  });
