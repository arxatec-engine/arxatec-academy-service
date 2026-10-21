import { prisma } from '@/config/prisma_client';
import type { Prisma } from '@/generated/client';
import { lesson_status } from '@/generated/enums';

const RESOURCE_SELECT = {
  id: true, title: true, file_url: true, file_key: true,
  mime_type: true, size_bytes: true, position: true,
} as const satisfies Prisma.lesson_resourcesSelect;

const LESSON_SELECT = {
  id: true, course_id: true, slug: true, title: true, description: true,
  type: true, position: true, status: true, is_free_sample: true,
  video_provider: true, video_external_id: true, duration_seconds: true,
  article_body: true, article_word_count: true, reading_minutes: true,
  transcript: true, updated_at: true,
  course: { select: { id: true, title: true, status: true } },
  resources: { select: RESOURCE_SELECT, orderBy: { position: 'asc' } },
} as const satisfies Prisma.lessonsSelect;

export type AdminLessonRecord = Prisma.lessonsGetPayload<{ select: typeof LESSON_SELECT }>;

export const getAdminLesson = (id: string) => prisma.lessons.findUnique({ where: { id }, select: LESSON_SELECT });
export const getCourseForLessons = (id: string) => prisma.courses.findUnique({
  where: { id }, select: { id: true, title: true, status: true },
});
export const listAdminLessons = (course_id: string) => prisma.lessons.findMany({
  where: { course_id },
  select: {
    id: true, position: true, title: true, type: true, status: true,
    is_free_sample: true, duration_seconds: true, reading_minutes: true,
    updated_at: true, _count: { select: { resources: true } },
  }, orderBy: { position: 'asc' },
});
export const findLessonSlug = (course_id: string, slug: string) => prisma.lessons.findUnique({
  where: { course_id_slug: { course_id, slug } }, select: { id: true },
});
export const createAdminLesson = async (course_id: string, data: {
  title: string; slug: string; type: 'VIDEO' | 'ARTICLE';
}) => prisma.$transaction(async (tx) => {
  const last = await tx.lessons.aggregate({ where: { course_id }, _max: { position: true } });
  return tx.lessons.create({ data: {
    course_id, ...data, description: '', position: (last._max.position ?? 0) + 1,
    status: lesson_status.DRAFT,
  }, select: { id: true } });
});
export const updateAdminLesson = (id: string, data: Prisma.lessonsUpdateInput) =>
  prisma.lessons.update({ where: { id }, data, select: { id: true } });
export const moveFreeSample = (course_id: string, id: string) => prisma.$transaction(async (tx) => {
  await tx.lessons.updateMany({ where: { course_id, id: { not: id } }, data: { is_free_sample: false } });
  await tx.lessons.update({ where: { id }, data: { is_free_sample: true }, select: { id: true } });
});
export const reorderAdminLessons = (course_id: string, ids: readonly string[]) =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.lessons.findMany({ where: { course_id }, select: { id: true } });
    if (rows.length !== ids.length || new Set(ids).size !== ids.length
      || ids.some((id) => !rows.some((row) => row.id === id))) {return false;}
    for (const [index, id] of ids.entries()) {
      await tx.lessons.update({ where: { id }, data: { position: -(index + 1) }, select: { id: true } });
    }
    for (const [index, id] of ids.entries()) {
      await tx.lessons.update({ where: { id }, data: { position: index + 1 }, select: { id: true } });
    }
    return true;
  });
export const lessonStudentDataCounts = async (id: string) => {
  const [progress_count, comment_count] = await Promise.all([
    prisma.lesson_progress.count({ where: { lesson_id: id } }),
    prisma.comments.count({ where: { lesson_id: id } }),
  ]);
  return { progress_count, comment_count };
};
export const deleteAdminLesson = (id: string, course_id: string) => prisma.$transaction(async (tx) => {
  const resources = await tx.lesson_resources.findMany({
    where: { lesson_id: id }, select: { file_key: true },
  });
  await tx.lessons.delete({ where: { id }, select: { id: true } });
  const remaining = await tx.lessons.findMany({
    where: { course_id }, select: { id: true }, orderBy: { position: 'asc' },
  });
  for (const [index, row] of remaining.entries()) {
    await tx.lessons.update({ where: { id: row.id }, data: { position: index + 1 }, select: { id: true } });
  }
  return resources.map((resource) => resource.file_key).filter((key): key is string => key !== null);
});

export const getAdminResource = (lesson_id: string, id: string) => prisma.lesson_resources.findFirst({
  where: { id, lesson_id }, select: RESOURCE_SELECT,
});
export const createAdminResource = async (lesson_id: string, data: {
  title: string; file_url: string; file_key: string; mime_type: string; size_bytes: number;
}) => prisma.$transaction(async (tx) => {
  const last = await tx.lesson_resources.aggregate({ where: { lesson_id }, _max: { position: true } });
  return tx.lesson_resources.create({ data: {
    lesson_id, ...data, position: (last._max.position ?? 0) + 1,
  }, select: RESOURCE_SELECT });
});
export const updateAdminResource = (lesson_id: string, id: string, title: string) =>
  prisma.lesson_resources.updateMany({ where: { lesson_id, id }, data: { title } });
export const deleteAdminResource = (lesson_id: string, id: string) => prisma.$transaction(async (tx) => {
  const resource = await tx.lesson_resources.delete({ where: { id, lesson_id }, select: RESOURCE_SELECT });
  const remaining = await tx.lesson_resources.findMany({
    where: { lesson_id }, select: { id: true }, orderBy: { position: 'asc' },
  });
  for (const [index, row] of remaining.entries()) {
    await tx.lesson_resources.update({ where: { id: row.id }, data: { position: index + 1 }, select: { id: true } });
  }
  return resource;
});
export const reorderAdminResources = (lesson_id: string, ids: readonly string[]) =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.lesson_resources.findMany({ where: { lesson_id }, select: { id: true } });
    if (rows.length !== ids.length || new Set(ids).size !== ids.length
      || ids.some((id) => !rows.some((row) => row.id === id))) {return false;}
    for (const [index, id] of ids.entries()) {
      await tx.lesson_resources.update({ where: { id }, data: { position: -(index + 1) }, select: { id: true } });
    }
    for (const [index, id] of ids.entries()) {
      await tx.lesson_resources.update({ where: { id }, data: { position: index + 1 }, select: { id: true } });
    }
    return true;
  });
