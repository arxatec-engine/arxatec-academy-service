import type { z } from 'zod';

import { AdminCoursePolicy, CoursePolicy } from '@/constants/courses';
import { ErrorCodes } from '@/constants/error_codes';
import { FileUsages } from '@/constants/files';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AdminCourseMessages } from '@/constants/messages/admin_courses';
import { ValidationKeys } from '@/constants/validation_keys';
import { course_status } from '@/generated/enums';
import { resolveStoredFileUrl } from '@/infrastructure/storage/file_url';
import { removeStoredFile } from '@/infrastructure/storage/cleanup';
import { storage } from '@/infrastructure/storage/storage';
import { buildStorageKey } from '@/infrastructure/storage/storage_key';
import { validateUpload } from '@/infrastructure/storage/validate_upload';
import type { UploadedFile } from '@/utils/uploaded_file';
import type {
  createAdminCourseSchema, updateAdminCourseSchema,
} from '@/modules/courses/features/admin_courses/domain/admin_courses.schema';
import {
  archiveAdminCourse, countPublishedLessons, createAdminCourse, duplicateAdminCourse,
  findAdminCourse, findCourseForDuplicate, findCourseSlug, getAdminCourse,
  listActiveCourseIds, listAdminCourses, updateAdminCourseAndMoveIfCurrent, updateAdminCourseIfCurrent,
  updateAdminCourseState, writeCatalogOrder,
  type AdminCourseRecord,
} from '@/modules/courses/shared/data/admin_courses.repository';
import { readImageDimensions } from '@/modules/courses/shared/policy/image_dimensions';
import { canPublishCourse } from '@/modules/courses/shared/policy/course_publication_policy';
import { normalizeSlug, slugCandidate } from '@/modules/courses/shared/policy/slug';
import { AppError } from '@/utils/errors';
import { findTeacherById } from '@/modules/courses/shared/data/teachers.repository';
import { isPrismaUniqueError } from '@/utils/prisma_errors';

const conflict = (message: string, code: typeof ErrorCodes[keyof typeof ErrorCodes]): AppError =>
  new AppError(message, HttpStatusCodes.CONFLICT.code, { code });

const notFound = (): AppError => new AppError(
  AdminCourseMessages.not_found, HttpStatusCodes.NOT_FOUND.code, { code: ErrorCodes.NOT_FOUND },
);

const requiredCourse = async (id: string): Promise<AdminCourseRecord> => {
  const course = await findAdminCourse(id);
  if (course === null) {throw notFound();}
  return course;
};

const serializeCourse = (course: AdminCourseRecord, published_lesson_count: number) => ({
  id: course.id, slug: course.slug, title: course.title,
  short_description: course.short_description, long_description: course.long_description,
  topic: course.topic, level: course.level, cover_image_url: resolveStoredFileUrl(course.cover_image_url, course.cover_image_key),
  teacher: course.teacher,
  status: course.status, catalog_order: course.catalog_order,
  published_at: course.published_at?.toISOString() ?? null,
  slug_locked: course.published_at !== null,
  can_publish: canPublishCourse({ published_lesson_count }),
  updated_at: course.updated_at.toISOString(),
});

export const getAdminCourseService = async (id: string) => {
  const course = await getAdminCourse(id);
  if (course === null) {throw notFound();}
  const published_lesson_count = course.lessons.filter((lesson) => lesson.status === 'PUBLISHED').length;
  return {
    course: serializeCourse(course, published_lesson_count),
    lessons: course.lessons.map((lesson) => ({ ...lesson })),
  };
};

export const listAdminCoursesService = async () => {
  const rows = await listAdminCourses();
  const sorted = [...rows].sort((a, b) =>
    Number(a.status === course_status.ARCHIVED) - Number(b.status === course_status.ARCHIVED)
    || a.catalog_order - b.catalog_order);
  return {
    courses: sorted.map((row) => ({
      id: row.id, title: row.title, slug: row.slug, topic: row.topic, level: row.level,
      status: row.status, lesson_count: row._count.lessons,
      published_lesson_count: row.lessons.length,
      catalog_order: row.catalog_order, updated_at: row.updated_at.toISOString(),
    })),
    counts: {
      total: rows.length,
      published: rows.filter((row) => row.status === course_status.PUBLISHED).length,
      draft: rows.filter((row) => row.status === course_status.DRAFT).length,
      archived: rows.filter((row) => row.status === course_status.ARCHIVED).length,
    },
  };
};

const nextSlug = async (title: string): Promise<string> => {
  const base = normalizeSlug(title) || 'curso';
  for (let suffix = 1; ; suffix += 1) {
    const candidate = slugCandidate(base, suffix);
    if (await findCourseSlug(candidate) === null) {return candidate;}
  }
};

export const createAdminCourseService = async (payload: z.infer<typeof createAdminCourseSchema>) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = await nextSlug(payload.title);
    try {
      const created = await createAdminCourse({ ...payload, slug });
      return getAdminCourseService(created.id);
    } catch (error) {
      if (!isPrismaUniqueError(error) || attempt === 2) {throw error;}
    }
  }
  throw conflict(AdminCourseMessages.slug_taken, ErrorCodes.SLUG_TAKEN);
};

export const updateAdminCourseService = async (
  id: string, payload: z.infer<typeof updateAdminCourseSchema>,
) => {
  const current = await requiredCourse(id);
  const { expected_updated_at, catalog_order, teacher, ...fields } = payload;
  if (teacher?.id !== undefined && await findTeacherById(teacher.id) === null) {
    throw new AppError(AdminCourseMessages.teacher_not_found, HttpStatusCodes.NOT_FOUND.code,
      { code: ErrorCodes.NOT_FOUND });
  }
  if (fields.slug !== undefined && fields.slug !== current.slug) {
    if (current.published_at !== null) {
      throw conflict(AdminCourseMessages.slug_locked, ErrorCodes.SLUG_LOCKED);
    }
    if (await findCourseSlug(fields.slug) !== null) {
      throw conflict(AdminCourseMessages.slug_taken, ErrorCodes.SLUG_TAKEN);
    }
  }
  let outcome: 'updated' | 'stale' | 'order';
  try {
    if (catalog_order !== undefined && current.status !== course_status.ARCHIVED) {
      outcome = await updateAdminCourseAndMoveIfCurrent(id, new Date(expected_updated_at),
        fields, catalog_order, teacher);
    } else {
      const result = await updateAdminCourseIfCurrent(id, new Date(expected_updated_at), fields, teacher);
      outcome = result.count === 0 ? 'stale' : 'updated';
    }
  } catch (error) {
    if (fields.slug !== undefined && isPrismaUniqueError(error)) {
      throw conflict(AdminCourseMessages.slug_taken, ErrorCodes.SLUG_TAKEN);
    }
    throw error;
  }
  if (outcome === 'stale') {throw conflict(AdminCourseMessages.stale_update, ErrorCodes.STALE_UPDATE);}
  if (outcome === 'order') {throw conflict(AdminCourseMessages.stale_order, ErrorCodes.STALE_CATALOG_ORDER);}
  return getAdminCourseService(id);
};

export const publishAdminCourseService = async (id: string) => {
  const course = await requiredCourse(id);
  if (course.status === course_status.ARCHIVED) {
    throw conflict(AdminCourseMessages.archived_cannot_publish, ErrorCodes.INVALID_STATE_TRANSITION);
  }
  if (course.status === course_status.PUBLISHED) {return getAdminCourseService(id);}
  const count = await countPublishedLessons(id);
  if (!canPublishCourse({ published_lesson_count: count })) {
    throw conflict(AdminCourseMessages.no_lessons, ErrorCodes.COURSE_HAS_NO_LESSONS);
  }
  const fields: Record<string, string> = {};
  if (!course.short_description.trim()) {fields['short_description'] = ValidationKeys.common.required;}
  if (!course.long_description.trim()) {fields['long_description'] = ValidationKeys.common.required;}
  if (Object.keys(fields).length > 0) {
    throw new AppError(AdminCourseMessages.incomplete, HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      { code: ErrorCodes.VALIDATION_ERROR, fields });
  }
  await updateAdminCourseState(id, {
    status: course_status.PUBLISHED,
    published_at: course.published_at ?? new Date(),
  });
  return getAdminCourseService(id);
};

export const unpublishAdminCourseService = async (id: string) => {
  const course = await requiredCourse(id);
  if (course.status !== course_status.DRAFT) {
    await updateAdminCourseState(id, { status: course_status.DRAFT });
  }
  return getAdminCourseService(id);
};

export const archiveAdminCourseService = async (id: string) => {
  const course = await requiredCourse(id);
  if (course.status !== course_status.ARCHIVED) {await archiveAdminCourse(id);}
  return getAdminCourseService(id);
};

export const duplicateAdminCourseService = async (id: string) => {
  const source = await findCourseForDuplicate(id);
  if (source === null) {throw notFound();}
  const suffix = AdminCoursePolicy.duplicate_suffix;
  const title = `${source.title.slice(0, CoursePolicy.title_max_length - suffix.length)}${suffix}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = await nextSlug(title);
    try {
      const copy = await duplicateAdminCourse(source, title, slug);
      return getAdminCourseService(copy.id);
    } catch (error) {
      if (!isPrismaUniqueError(error) || attempt === 2) {throw error;}
    }
  }
  throw conflict(AdminCourseMessages.slug_taken, ErrorCodes.SLUG_TAKEN);
};

export const reorderAdminCoursesService = async (ids: readonly string[]) => {
  const current = await listActiveCourseIds();
  const currentIds = new Set(current.map((course) => course.id));
  if (currentIds.size !== ids.length || ids.some((id) => !currentIds.has(id))) {
    throw conflict(AdminCourseMessages.stale_order, ErrorCodes.STALE_CATALOG_ORDER);
  }
  if (!await writeCatalogOrder(ids)) {
    throw conflict(AdminCourseMessages.stale_order, ErrorCodes.STALE_CATALOG_ORDER);
  }
  return listAdminCoursesService();
};

export const updateAdminCourseCoverService = async (id: string, file: UploadedFile) => {
  const current = await requiredCourse(id);
  const validated = validateUpload({
    usage: FileUsages.course_cover, mime_type: file.mime_type,
    size_bytes: file.size_bytes, content: file.content,
  });
  const dimensions = readImageDimensions(file.content, validated.mime_type);
  if (dimensions === null || dimensions.width < AdminCoursePolicy.cover_min_width
    || dimensions.height < AdminCoursePolicy.cover_min_height
    || dimensions.width <= dimensions.height) {
    throw new AppError(AdminCourseMessages.image_too_small, HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      { code: ErrorCodes.IMAGE_TOO_SMALL, fields: { file: ValidationKeys.common.invalid } });
  }
  const stored = await storage.save({
    key: buildStorageKey({ usage: validated.usage, mime_type: validated.mime_type }),
    content: file.content, mime_type: validated.mime_type,
  });
  try {
    await updateAdminCourseState(id, { cover_image_url: stored.url, cover_image_key: stored.key });
  } catch (error) {
    await removeStoredFile(stored.key);
    throw error;
  }
  await removeStoredFile(current.cover_image_key);
  return getAdminCourseService(id);
};
