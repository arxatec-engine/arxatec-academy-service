import type { z } from 'zod';

import { logger } from '@/config/logger';
import { ErrorCodes } from '@/constants/error_codes';
import { FileUsages } from '@/constants/files';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AdminLessonMessages } from '@/constants/messages/admin_lessons';
import { lesson_status, lesson_type, video_provider } from '@/generated/enums';
import { storage } from '@/infrastructure/storage/storage';
import { buildStorageKey } from '@/infrastructure/storage/storage_key';
import { validateUpload } from '@/infrastructure/storage/validate_upload';
import { probeVideo } from '@/infrastructure/video/probe_video';
import type { UploadedFile } from '@/utils/uploaded_file';
import { probeVideoSchema, type createAdminLessonSchema, type updateAdminLessonSchema } from '@/modules/courses/features/admin_lessons/domain/admin_lessons.schema';
import {
  countResourceFileReferences, createAdminLesson, createAdminResource, deleteAdminLesson,
  deleteAdminResource, findLessonSlug, getAdminLesson, getAdminResource,
  getCourseForLessons, lessonStudentDataCounts, listAdminLessons, moveFreeSample,
  reorderAdminLessons, reorderAdminResources, updateAdminLesson, updateAdminResource,
  type AdminLessonRecord,
} from '@/modules/courses/shared/data/admin_lessons.repository';
import { sanitizeArticleBody } from '@/modules/courses/shared/domain/sanitize_article_body';
import { readingTime } from '@/modules/courses/shared/policy/reading_time';
import { normalizeSlug, slugCandidate } from '@/modules/courses/shared/policy/slug';
import { AppError, isAppError } from '@/utils/errors';
import { isPrismaUniqueError } from '@/utils/prisma_errors';

const fail = (message: string, status: number, code: typeof ErrorCodes[keyof typeof ErrorCodes],
  data?: unknown): AppError => new AppError(message, status, { code }, data);
const missing = (): AppError => fail(AdminLessonMessages.not_found, HttpStatusCodes.NOT_FOUND.code, ErrorCodes.NOT_FOUND);
const required = async (id: string): Promise<AdminLessonRecord> => {
  const lesson = await getAdminLesson(id);
  if (lesson === null) {throw missing();}
  return lesson;
};
const requiredCourse = async (id: string) => {
  const course = await getCourseForLessons(id);
  if (course === null) {throw fail(AdminLessonMessages.not_found, HttpStatusCodes.NOT_FOUND.code, ErrorCodes.NOT_FOUND);}
  return course;
};

export const listAdminLessonsService = async (course_id: string) => {
  const course = await requiredCourse(course_id);
  const lessons = await listAdminLessons(course_id);
  return { course, lessons: lessons.map((lesson) => ({
    id: lesson.id, position: lesson.position, title: lesson.title, type: lesson.type,
    status: lesson.status, is_free_sample: lesson.is_free_sample,
    duration_seconds: lesson.duration_seconds, reading_minutes: lesson.reading_minutes,
    resource_count: lesson._count.resources, updated_at: lesson.updated_at.toISOString(),
  })) };
};

export const getAdminLessonService = async (id: string) => {
  const row = await required(id);
  return {
    lesson: {
      id: row.id, slug: row.slug, title: row.title, description: row.description,
      type: row.type, position: row.position, status: row.status,
      is_free_sample: row.is_free_sample,
      video: row.video_provider === null ? null
        : { provider: row.video_provider, external_id: row.video_external_id },
      duration_seconds: row.duration_seconds, article_body: row.article_body,
      article_word_count: row.article_word_count, reading_minutes: row.reading_minutes,
      transcript: row.transcript,
      resources: row.resources.map((resource) => ({
        id: resource.id, title: resource.title, file_url: resource.file_url,
        mime_type: resource.mime_type, size_bytes: resource.size_bytes,
        position: resource.position,
      })),
      updated_at: row.updated_at.toISOString(),
    },
    course: { id: row.course.id, title: row.course.title },
  };
};

const nextLessonSlug = async (course_id: string, title: string): Promise<string> => {
  const base = normalizeSlug(title) || 'leccion';
  for (let suffix = 1; ; suffix += 1) {
    const candidate = slugCandidate(base, suffix);
    if (await findLessonSlug(course_id, candidate) === null) {return candidate;}
  }
};

export const createAdminLessonService = async (
  course_id: string, payload: z.infer<typeof createAdminLessonSchema>,
) => {
  await requiredCourse(course_id);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const slug = await nextLessonSlug(course_id, payload.title);
    try {
      const row = await createAdminLesson(course_id, { ...payload, slug });
      return getAdminLessonService(row.id);
    } catch (error) {
      if (!isPrismaUniqueError(error) || attempt === 1) {throw error;}
    }
  }
  throw fail(AdminLessonMessages.slug_taken, HttpStatusCodes.CONFLICT.code, ErrorCodes.LESSON_SLUG_TAKEN);
};

export const updateAdminLessonService = async (
  id: string, payload: z.infer<typeof updateAdminLessonSchema>,
) => {
  const row = await required(id);
  const { confirm_type_change, is_free_sample, duration_seconds, ...fields } = payload;
  if (fields.slug !== undefined && fields.slug !== row.slug
    && await findLessonSlug(row.course_id, fields.slug) !== null) {
    throw fail(AdminLessonMessages.slug_taken, HttpStatusCodes.CONFLICT.code, ErrorCodes.LESSON_SLUG_TAKEN);
  }
  const changingType = fields.type !== undefined && fields.type !== row.type;
  const hasContent = row.type === lesson_type.ARTICLE
    ? Boolean(row.article_body?.trim()) : row.video_external_id !== null;
  if (changingType && hasContent && confirm_type_change !== true) {
    throw fail(AdminLessonMessages.type_change, HttpStatusCodes.CONFLICT.code,
      ErrorCodes.LESSON_TYPE_CHANGE_NOT_CONFIRMED, {
        from: row.type, to: fields.type,
        will_discard: row.type === lesson_type.ARTICLE
          ? ['article_body', 'article_word_count', 'reading_minutes']
          : ['video_provider', 'video_external_id', 'duration_seconds'],
      });
  }
  const data = { ...fields };
  if (changingType) {
    Object.assign(data, {
      video_provider: null, video_external_id: null, duration_seconds: null,
      article_body: null, article_word_count: null, reading_minutes: null,
    });
  }
  const nextType = fields.type ?? row.type;
  const nextProvider = fields.video_provider === undefined
    ? (row.video_provider ?? video_provider.YOUTUBE) : fields.video_provider;
  let contentRemoved = changingType || fields.description === '';
  // A PATCH may contain stale editor fields from the other content type. They must never
  // re-populate columns cleared by a type change (nor create mixed VIDEO/ARTICLE rows).
  if (nextType === lesson_type.VIDEO) {
    delete data.article_body;
    if (changingType) {
      Object.assign(data, { article_body: null,
        video_provider: fields.video_provider ?? (fields.video_external_id ? video_provider.YOUTUBE : null),
        video_external_id: fields.video_external_id ?? null });
    } else if (fields.video_external_id && row.video_provider === null && fields.video_provider === undefined) {
      Object.assign(data, { video_provider: video_provider.YOUTUBE });
    }
  } else {
    delete data.video_provider;
    delete data.video_external_id;
    if (changingType) {Object.assign(data, { video_provider: null, video_external_id: null });}
  }
  if (nextType === lesson_type.ARTICLE && fields.article_body !== undefined) {
    const sanitized = sanitizeArticleBody(fields.article_body ?? '');
    if (sanitized.length > 150_000) {
      throw fail(AdminLessonMessages.incomplete, HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
        ErrorCodes.VALIDATION_ERROR);
    }
    const metrics = readingTime(sanitized);
    if (metrics.article_word_count === 0) {contentRemoved = true;}
    Object.assign(data, { article_body: sanitized, ...metrics });
  }
  let videoUnavailable = false;
  if (nextType === lesson_type.VIDEO) {
    const nextId = fields.video_external_id === undefined ? row.video_external_id : fields.video_external_id;
    const sourceChanged = nextId !== row.video_external_id || nextProvider !== row.video_provider;
    if (nextId && nextProvider !== null) {
      probeVideoSchema.parse({ provider: nextProvider, external_id: nextId });
    }
    if (sourceChanged && (!nextId || nextProvider === null)) {
      Object.assign(data, { duration_seconds: null });
      contentRemoved = true;
    } else if (sourceChanged && nextId && nextProvider) {
      try {
        const probed = await probeVideo(nextProvider, nextId);
        Object.assign(data, { duration_seconds: nextProvider === video_provider.YOUTUBE
          ? (duration_seconds ?? null) : probed.duration_seconds });
        if (nextProvider === video_provider.YOUTUBE && duration_seconds === undefined) {
          contentRemoved = true;
        }
      } catch (error) {
        if (!isAppError(error) || error.meta?.code !== ErrorCodes.VIDEO_PROVIDER_UNAVAILABLE) {throw error;}
        Object.assign(data, { duration_seconds: null });
        videoUnavailable = true;
        contentRemoved = true;
      }
    } else if (nextProvider === video_provider.YOUTUBE && duration_seconds !== undefined) {
      Object.assign(data, { duration_seconds });
    }
  }
  if (nextType === lesson_type.VIDEO && fields.video_provider === null) {contentRemoved = true;}
  if (row.status === lesson_status.PUBLISHED && contentRemoved) {
    // Draft edits may be incomplete. Never leave a published row without publishable content.
    Object.assign(data, { status: lesson_status.DRAFT });
  }
  try {
    await updateAdminLesson(id, data);
  } catch (error) {
    if (fields.slug !== undefined && isPrismaUniqueError(error)) {
      throw fail(AdminLessonMessages.slug_taken, HttpStatusCodes.CONFLICT.code,
        ErrorCodes.LESSON_SLUG_TAKEN);
    }
    throw error;
  }
  if (is_free_sample === true) {await moveFreeSample(row.course_id, id);}
  if (is_free_sample === false) {await updateAdminLesson(id, { is_free_sample: false });}
  return { data: await getAdminLessonService(id), videoUnavailable };
};

export const publishAdminLessonService = async (id: string) => {
  const row = await required(id);
  if (row.status === lesson_status.PUBLISHED) {return getAdminLessonService(id);}
  const missingFields: string[] = [];
  if (!row.title.trim()) {missingFields.push('title');}
  if (!row.slug.trim()) {missingFields.push('slug');}
  if (!row.description.trim()) {missingFields.push('description');}
  if (row.type === lesson_type.ARTICLE) {
    if (!row.article_body || readingTime(row.article_body).article_word_count === 0) {
      throw fail(AdminLessonMessages.article_empty, HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
        ErrorCodes.ARTICLE_BODY_EMPTY);
    }
    if (row.article_word_count === null || row.reading_minutes === null) {missingFields.push('article_body');}
  } else {
    if (row.video_provider === null) {missingFields.push('video_provider');}
    if (!row.video_external_id) {missingFields.push('video_external_id');}
    let duration = row.duration_seconds;
    if (duration === null && row.video_external_id && row.video_provider === video_provider.VIMEO) {
      const probe = await probeVideo(row.video_provider, row.video_external_id);
      duration = probe.duration_seconds;
      if (duration !== null) {await updateAdminLesson(id, { duration_seconds: duration });}
    }
    if (duration === null) {missingFields.push('duration_seconds');}
  }
  if (missingFields.length > 0) {
    throw fail(AdminLessonMessages.incomplete, HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      ErrorCodes.LESSON_INCOMPLETE, { missing_fields: missingFields });
  }
  await updateAdminLesson(id, { status: lesson_status.PUBLISHED });
  return getAdminLessonService(id);
};

export const unpublishAdminLessonService = async (id: string) => {
  await required(id);
  await updateAdminLesson(id, { status: lesson_status.DRAFT });
  return getAdminLessonService(id);
};

const removeFileIfUnused = async (file_key: string): Promise<void> => {
  if (await countResourceFileReferences(file_key) > 0) {return;}
  try { await storage.remove(file_key); }
  catch (error) { logger.warn({ err: error }, AdminLessonMessages.resource_remove_failed); }
};

export const deleteAdminLessonService = async (id: string, confirmed: boolean) => {
  const row = await required(id);
  if (row.status === lesson_status.PUBLISHED) {
    throw fail(AdminLessonMessages.published_delete, HttpStatusCodes.CONFLICT.code, ErrorCodes.LESSON_PUBLISHED);
  }
  const counts = await lessonStudentDataCounts(id);
  if ((counts.progress_count > 0 || counts.comment_count > 0) && !confirmed) {
    throw fail(AdminLessonMessages.student_data, HttpStatusCodes.CONFLICT.code,
      ErrorCodes.LESSON_HAS_STUDENT_DATA, counts);
  }
  const keys = await deleteAdminLesson(id, row.course_id);
  for (const key of keys) {await removeFileIfUnused(key);}
};

export const reorderAdminLessonsService = async (course_id: string, ids: readonly string[]) => {
  await requiredCourse(course_id);
  if (!await reorderAdminLessons(course_id, ids)) {
    throw fail(AdminLessonMessages.order_mismatch, HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      ErrorCodes.LESSON_ORDER_MISMATCH);
  }
  return listAdminLessonsService(course_id);
};

export const createAdminResourceService = async (lesson_id: string, title: string, file: UploadedFile) => {
  await required(lesson_id);
  const validated = validateUpload({
    usage: FileUsages.lesson_resource, mime_type: file.mime_type,
    size_bytes: file.size_bytes, content: file.content,
  });
  const stored = await storage.save({
    key: buildStorageKey({ usage: validated.usage, mime_type: validated.mime_type }),
    content: file.content, mime_type: validated.mime_type,
  });
  try {
    const row = await createAdminResource(lesson_id, {
      title, file_url: stored.url, file_key: stored.key,
      mime_type: stored.mime_type, size_bytes: stored.size_bytes,
    });
    return { resource: { id: row.id, title: row.title, file_url: row.file_url,
      mime_type: row.mime_type, size_bytes: row.size_bytes, position: row.position } };
  } catch (error) {
    await storage.remove(stored.key);
    throw error;
  }
};

const requiredResource = async (lesson_id: string, id: string) => {
  const resource = await getAdminResource(lesson_id, id);
  if (resource === null) {throw fail(AdminLessonMessages.resource_not_found,
    HttpStatusCodes.NOT_FOUND.code, ErrorCodes.NOT_FOUND);}
  return resource;
};
export const updateAdminResourceService = async (lesson_id: string, id: string, title: string) => {
  await requiredResource(lesson_id, id);
  await updateAdminResource(lesson_id, id, title);
  const row = await requiredResource(lesson_id, id);
  return { resource: { id: row.id, title: row.title, file_url: row.file_url,
    mime_type: row.mime_type, size_bytes: row.size_bytes, position: row.position } };
};
export const deleteAdminResourceService = async (lesson_id: string, id: string) => {
  await requiredResource(lesson_id, id);
  const row = await deleteAdminResource(lesson_id, id);
  if (row.file_key !== null) {await removeFileIfUnused(row.file_key);}
};
export const reorderAdminResourcesService = async (lesson_id: string, ids: readonly string[]) => {
  await required(lesson_id);
  if (!await reorderAdminResources(lesson_id, ids)) {
    throw fail(AdminLessonMessages.order_mismatch, HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      ErrorCodes.LESSON_ORDER_MISMATCH);
  }
  return getAdminLessonService(lesson_id);
};
export const probeAdminVideoService = (provider: video_provider, external_id: string) =>
  probeVideo(provider, external_id);
