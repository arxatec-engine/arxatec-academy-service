import type { Request, Response } from 'express';

import { HttpStatusCodes, type HttpStatus } from '@/constants/http_status_codes';
import { AdminCourseMessages } from '@/constants/messages/admin_courses';
import {
  adminCourseIdSchema, createAdminCourseSchema, reorderAdminCoursesSchema,
  updateAdminCourseSchema,
} from '@/modules/courses/features/admin_courses/domain/admin_courses.schema';
import {
  archiveAdminCourseService, createAdminCourseService, duplicateAdminCourseService,
  getAdminCourseService, listAdminCoursesService, publishAdminCourseService,
  reorderAdminCoursesService, unpublishAdminCourseService, updateAdminCourseCoverService,
  updateAdminCourseService,
} from '@/modules/courses/features/admin_courses/presentation/admin_courses.service';
import { requireUploadedFile } from '@/utils/uploaded_file';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

const respond = (req: Request, res: Response, status: HttpStatus, description: string, data: unknown): void => {
  res.status(status.code).json(buildHttpResponse({ status, description, path: req.originalUrl, data }));
};

const idFrom = (req: Request): string => adminCourseIdSchema.parse(req.params).id;

export const listAdminCoursesController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const data = await listAdminCoursesService();
  respond(req, res, HttpStatusCodes.OK, AdminCourseMessages.listed, data);
};

export const createAdminCourseController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const payload = createAdminCourseSchema.parse(req.body);
  const data = await createAdminCourseService(payload);
  respond(req, res, HttpStatusCodes.CREATED, AdminCourseMessages.created, data);
};

export const getAdminCourseController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = idFrom(req);
  const data = await getAdminCourseService(id);
  respond(req, res, HttpStatusCodes.OK, AdminCourseMessages.found, data);
};

export const updateAdminCourseController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = idFrom(req);
  const payload = updateAdminCourseSchema.parse(req.body);
  const data = await updateAdminCourseService(id, payload);
  respond(req, res, HttpStatusCodes.OK, AdminCourseMessages.updated, data);
};

export const publishAdminCourseController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = idFrom(req);
  const data = await publishAdminCourseService(id);
  respond(req, res, HttpStatusCodes.OK, AdminCourseMessages.published, data);
};

export const unpublishAdminCourseController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = idFrom(req);
  const data = await unpublishAdminCourseService(id);
  respond(req, res, HttpStatusCodes.OK, AdminCourseMessages.unpublished, data);
};

export const duplicateAdminCourseController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = idFrom(req);
  const data = await duplicateAdminCourseService(id);
  respond(req, res, HttpStatusCodes.CREATED, AdminCourseMessages.duplicated, data);
};

export const archiveAdminCourseController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = idFrom(req);
  const data = await archiveAdminCourseService(id);
  respond(req, res, HttpStatusCodes.OK, AdminCourseMessages.archived, data);
};

export const reorderAdminCoursesController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const payload = reorderAdminCoursesSchema.parse(req.body);
  const data = await reorderAdminCoursesService(payload.course_ids);
  respond(req, res, HttpStatusCodes.OK, AdminCourseMessages.reordered, data);
};

export const updateAdminCourseCoverController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const id = idFrom(req);
  const file = requireUploadedFile(req);
  const data = await updateAdminCourseCoverService(id, file);
  respond(req, res, HttpStatusCodes.OK, AdminCourseMessages.cover_updated, data);
};
