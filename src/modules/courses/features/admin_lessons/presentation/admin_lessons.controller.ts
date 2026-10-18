import type { Request, Response } from 'express';

import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes, type HttpStatus } from '@/constants/http_status_codes';
import { AdminLessonMessages } from '@/constants/messages/admin_lessons';
import {
  courseIdSchema, createAdminLessonSchema, deleteAdminLessonSchema,
  lessonIdSchema, lessonResourceIdSchema, probeVideoSchema,
  reorderLessonsSchema, reorderResourcesSchema, resourceTitleSchema,
  updateAdminLessonSchema,
} from '@/modules/courses/features/admin_lessons/domain/admin_lessons.schema';
import {
  createAdminLessonService, createAdminResourceService, deleteAdminLessonService,
  deleteAdminResourceService, getAdminLessonService, listAdminLessonsService,
  probeAdminVideoService, publishAdminLessonService, reorderAdminLessonsService,
  reorderAdminResourcesService, unpublishAdminLessonService,
  updateAdminLessonService, updateAdminResourceService,
} from '@/modules/courses/features/admin_lessons/presentation/admin_lessons.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse, type HttpResponseMeta } from '@/utils/build_http_response';
import { requireUploadedFile } from '@/utils/uploaded_file';

const respond = (req: Request, res: Response, status: HttpStatus, description: string,
  data?: unknown, meta?: HttpResponseMeta): void => {
  res.status(status.code).json(buildHttpResponse({ status, description, path: req.originalUrl, data, meta }));
};
const lessonId = (req: Request): string => lessonIdSchema.parse(req.params).id;
const courseId = (req: Request): string => courseIdSchema.parse(req.params).course_id;

export const listAdminLessonsController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = courseId(req);
  respond(req, res, HttpStatusCodes.OK, AdminLessonMessages.listed, await listAdminLessonsService(id));
};
export const createAdminLessonController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = courseId(req);
  const payload = createAdminLessonSchema.parse(req.body);
  respond(req, res, HttpStatusCodes.CREATED, AdminLessonMessages.created,
    await createAdminLessonService(id, payload));
};
export const getAdminLessonController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = lessonId(req);
  respond(req, res, HttpStatusCodes.OK, AdminLessonMessages.found, await getAdminLessonService(id));
};
export const updateAdminLessonController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = lessonId(req);
  const payload = updateAdminLessonSchema.parse(req.body);
  const result = await updateAdminLessonService(id, payload);
  respond(req, res, HttpStatusCodes.OK, AdminLessonMessages.updated, result.data,
    result.videoUnavailable ? { code: ErrorCodes.VIDEO_PROVIDER_UNAVAILABLE } : undefined);
};
export const publishAdminLessonController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = lessonId(req);
  respond(req, res, HttpStatusCodes.OK, AdminLessonMessages.published, await publishAdminLessonService(id));
};
export const unpublishAdminLessonController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = lessonId(req);
  respond(req, res, HttpStatusCodes.OK, AdminLessonMessages.unpublished,
    await unpublishAdminLessonService(id));
};
export const deleteAdminLessonController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = lessonId(req);
  const payload = deleteAdminLessonSchema.parse(req.body ?? {});
  await deleteAdminLessonService(id, payload.confirm_destroys_student_data === true);
  res.status(HttpStatusCodes.NO_CONTENT.code).send();
};
export const reorderAdminLessonsController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = courseId(req);
  const payload = reorderLessonsSchema.parse(req.body);
  respond(req, res, HttpStatusCodes.OK, AdminLessonMessages.reordered,
    await reorderAdminLessonsService(id, payload.lesson_ids));
};
export const createAdminResourceController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const { lesson_id } = lessonResourceIdSchema.pick({ lesson_id: true }).parse(req.params);
  const payload = resourceTitleSchema.parse(req.body);
  const file = requireUploadedFile(req);
  respond(req, res, HttpStatusCodes.CREATED, AdminLessonMessages.resource_created,
    await createAdminResourceService(lesson_id, payload.title, file));
};
export const updateAdminResourceController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const { lesson_id, id } = lessonResourceIdSchema.parse(req.params);
  const payload = resourceTitleSchema.parse(req.body);
  respond(req, res, HttpStatusCodes.OK, AdminLessonMessages.resource_updated,
    await updateAdminResourceService(lesson_id, id, payload.title));
};
export const deleteAdminResourceController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const { lesson_id, id } = lessonResourceIdSchema.parse(req.params);
  await deleteAdminResourceService(lesson_id, id);
  res.status(HttpStatusCodes.NO_CONTENT.code).send();
};
export const reorderAdminResourcesController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const { lesson_id } = lessonResourceIdSchema.pick({ lesson_id: true }).parse(req.params);
  const payload = reorderResourcesSchema.parse(req.body);
  respond(req, res, HttpStatusCodes.OK, AdminLessonMessages.resources_reordered,
    await reorderAdminResourcesService(lesson_id, payload.resource_ids));
};
export const probeAdminVideoController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const payload = probeVideoSchema.parse(req.body);
  respond(req, res, HttpStatusCodes.OK, AdminLessonMessages.video_probed,
    await probeAdminVideoService(payload.provider, payload.external_id));
};
