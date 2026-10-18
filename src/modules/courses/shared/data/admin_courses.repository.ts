import { prisma } from '@/config/prisma_client';
import { course_status, lesson_status } from '@/generated/enums';
import type { Prisma } from '@/generated/client';
import { TEACHER_SELECT, writeCourseTeacher } from '@/modules/courses/shared/data/teachers.repository';
import type { TeacherInput } from '@/modules/courses/shared/domain/teacher.schema';

export const ADMIN_COURSE_SELECT = {
  id: true, slug: true, title: true, short_description: true, long_description: true,
  topic: true, level: true, cover_image_url: true, cover_image_key: true, status: true, catalog_order: true,
  published_at: true, updated_at: true,
  teacher: { select: TEACHER_SELECT },
} as const satisfies Prisma.coursesSelect;

export const ADMIN_LESSON_SUMMARY_SELECT = {
  id: true, title: true, type: true, position: true, status: true,
  duration_seconds: true, reading_minutes: true, is_free_sample: true,
} as const satisfies Prisma.lessonsSelect;

export type AdminCourseRecord = Prisma.coursesGetPayload<{ select: typeof ADMIN_COURSE_SELECT }>;

export const listAdminCourses = () => prisma.courses.findMany({
  select: {
    ...ADMIN_COURSE_SELECT,
    _count: { select: { lessons: true } },
    lessons: { where: { status: lesson_status.PUBLISHED }, select: { id: true } },
  },
  orderBy: [{ catalog_order: 'asc' }, { id: 'asc' }],
});

export const getAdminCourse = (id: string) => prisma.courses.findUnique({
  where: { id },
  select: {
    ...ADMIN_COURSE_SELECT,
    lessons: { select: ADMIN_LESSON_SUMMARY_SELECT, orderBy: { position: 'asc' } },
  },
});

export const findAdminCourse = (id: string) => prisma.courses.findUnique({
  where: { id }, select: ADMIN_COURSE_SELECT,
});

export const findCourseSlug = (slug: string) => prisma.courses.findUnique({
  where: { slug }, select: { id: true },
});

export const createAdminCourse = (data: Omit<Prisma.coursesCreateInput,
  'slug' | 'catalog_order' | 'status'> & { slug: string }) =>
  prisma.$transaction(async (tx) => {
    const last = await tx.courses.aggregate({
      where: { status: { not: course_status.ARCHIVED } },
      _max: { catalog_order: true },
    });
    return tx.courses.create({
      data: { ...data, status: course_status.DRAFT, catalog_order: (last._max.catalog_order ?? 0) + 1 },
      select: { id: true },
    });
  });

export const updateAdminCourseIfCurrent = (
  id: string, expected: Date, data: Prisma.coursesUpdateManyMutationInput,
  teacher?: TeacherInput | null,
) => prisma.$transaction(async (tx) => {
  const updatedAt = new Date(Math.max(Date.now(), expected.getTime() + 1));
  const result = await tx.courses.updateMany({
    where: { id, updated_at: expected }, data: { ...data, updated_at: updatedAt },
  });
  if (result.count > 0) {await writeCourseTeacher(tx, id, teacher, updatedAt);}
  return result;
});

export const updateAdminCourseAndMoveIfCurrent = (
  id: string, expected: Date, data: Prisma.coursesUpdateManyMutationInput, position: number,
  teacher?: TeacherInput | null,
) => prisma.$transaction(async (tx) => {
  const active = await tx.courses.findMany({
    where: { status: { not: course_status.ARCHIVED } }, select: { id: true },
    orderBy: [{ catalog_order: 'asc' }, { id: 'asc' }],
  });
  if (!active.some((row) => row.id === id)) {return 'order' as const;}
  const updatedAt = new Date(Math.max(Date.now(), expected.getTime() + 1));
  const result = await tx.courses.updateMany({
    where: { id, updated_at: expected }, data: { ...data, updated_at: updatedAt },
  });
  if (result.count === 0) {return 'stale' as const;}
  await writeCourseTeacher(tx, id, teacher, updatedAt);
  const ids = active.map((row) => row.id).filter((course_id) => course_id !== id);
  ids.splice(Math.min(position - 1, ids.length), 0, id);
  for (const [index, course_id] of ids.entries()) {
    await tx.courses.update({ where: { id: course_id }, data: {
      catalog_order: index + 1, ...(course_id === id ? { updated_at: updatedAt } : {}),
    },
      select: { id: true } });
  }
  return 'updated' as const;
});

export const updateAdminCourseState = (id: string, data: Prisma.coursesUpdateInput) =>
  prisma.courses.update({ where: { id }, data, select: ADMIN_COURSE_SELECT });

export const countPublishedLessons = (course_id: string) => prisma.lessons.count({
  where: { course_id, status: lesson_status.PUBLISHED },
});

export const listActiveCourseIds = () => prisma.courses.findMany({
  where: { status: { not: course_status.ARCHIVED } },
  select: { id: true }, orderBy: [{ catalog_order: 'asc' }, { id: 'asc' }],
});

export const writeCatalogOrder = (ids: readonly string[]) => prisma.$transaction(async (tx) => {
  const current = await tx.courses.findMany({
    where: { status: { not: course_status.ARCHIVED } }, select: { id: true },
  });
  if (current.length !== ids.length || new Set(ids).size !== ids.length
    || ids.some((id) => !current.some((row) => row.id === id))) {return false;}
  for (const [index, id] of ids.entries()) {
    await tx.courses.update({ where: { id }, data: { catalog_order: index + 1 }, select: { id: true } });
  }
  return true;
});

export const archiveAdminCourse = (id: string) => prisma.$transaction(async (tx) => {
  const course = await tx.courses.update({
    where: { id }, data: { status: course_status.ARCHIVED }, select: ADMIN_COURSE_SELECT,
  });
  const remaining = await tx.courses.findMany({
    where: { status: { not: course_status.ARCHIVED } },
    select: { id: true }, orderBy: [{ catalog_order: 'asc' }, { id: 'asc' }],
  });
  for (const [index, row] of remaining.entries()) {
    await tx.courses.update({ where: { id: row.id }, data: { catalog_order: index + 1 }, select: { id: true } });
  }
  return course;
});

const DUPLICATE_SELECT = {
  teacher_id: true,
  title: true, short_description: true, long_description: true, topic: true, level: true,
  lessons: {
    select: {
      slug: true, title: true, description: true, type: true, position: true,
      video_provider: true, video_external_id: true, duration_seconds: true,
      article_body: true, article_word_count: true, reading_minutes: true,
      transcript: true, is_free_sample: true,
      resources: {
        select: { title: true, file_url: true, file_key: true, mime_type: true, size_bytes: true, position: true },
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { position: 'asc' },
  },
} as const satisfies Prisma.coursesSelect;

export const findCourseForDuplicate = (id: string) => prisma.courses.findUnique({
  where: { id }, select: DUPLICATE_SELECT,
});

export const duplicateAdminCourse = (
  source: NonNullable<Awaited<ReturnType<typeof findCourseForDuplicate>>>,
  title: string,
  slug: string,
) => prisma.$transaction(async (tx) => {
  const last = await tx.courses.aggregate({
    where: { status: { not: course_status.ARCHIVED } }, _max: { catalog_order: true },
  });
  return tx.courses.create({
    data: {
      title, slug, short_description: source.short_description,
      long_description: source.long_description, topic: source.topic, level: source.level,
      teacher: source.teacher_id ? { connect: { id: source.teacher_id } } : undefined,
      status: course_status.DRAFT, catalog_order: (last._max.catalog_order ?? 0) + 1,
      lessons: { create: source.lessons.map((lesson) => ({
        slug: lesson.slug, title: lesson.title, description: lesson.description,
        type: lesson.type, position: lesson.position, status: lesson_status.DRAFT,
        video_provider: lesson.video_provider, video_external_id: lesson.video_external_id,
        duration_seconds: lesson.duration_seconds, article_body: lesson.article_body,
        article_word_count: lesson.article_word_count, reading_minutes: lesson.reading_minutes,
        transcript: lesson.transcript, is_free_sample: lesson.is_free_sample,
        resources: { create: lesson.resources.map((resource) => ({ ...resource })) },
      })) },
    }, select: { id: true },
  });
});
