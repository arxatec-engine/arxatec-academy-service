import type { Request, Response } from 'express';

import { HttpStatusCodes, type HttpStatus } from '@/constants/http_status_codes';
import { NotificationMessages } from '@/constants/messages/notifications';
import {
  createSignupSchema, createTopicSchema, deleteSubscriberSchema, notifySignupsSchema,
  signupFiltersSchema, signupListSchema,
} from '@/modules/notifications/shared/domain/notification.schema';
import {
  createSignupService, createTopicRequestService, deleteSubscriberService,
  exportSignupsService, listSignupsService, listTopicRequestsService, notifySignupsService,
} from '@/modules/notifications/presentation/notifications.service';
import { getAuthenticatedUser, getOptionalUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';
import { reportingDay } from '@/utils/reporting_date';

const respond = (req: Request, res: Response, status: HttpStatus, description: string, data?: unknown): void => {
  res.status(status.code).json(buildHttpResponse({ status, description, path: req.originalUrl, data }));
};

export const createSignupController = async (req: Request, res: Response): Promise<void> => {
  const user = getOptionalUser(req);
  const payload = user === null ? createSignupSchema.parse(req.body)
    : createSignupSchema.omit({ email: true }).parse(req.body);
  await createSignupService(payload, user, req.ip);
  respond(req, res, HttpStatusCodes.OK, NotificationMessages.signup_created);
};
export const createTopicController = async (req: Request, res: Response): Promise<void> => {
  const user = getOptionalUser(req);
  const payload = user === null ? createTopicSchema.parse(req.body)
    : createTopicSchema.omit({ email: true }).parse(req.body);
  await createTopicRequestService(payload, user, req.ip);
  respond(req, res, HttpStatusCodes.OK, NotificationMessages.topic_created);
};
export const listSignupsController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const query = signupListSchema.parse(req.query);
  respond(req, res, HttpStatusCodes.OK, NotificationMessages.signups_listed, await listSignupsService(query));
};
export const exportSignupsController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const filters = signupFiltersSchema.parse(req.query);
  const csv = await exportSignupsService(filters);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="avisos-${reportingDay(new Date())}.csv"`);
  res.setHeader('Content-Length', csv.byteLength);
  res.setHeader('Cache-Control', 'no-store');
  res.status(HttpStatusCodes.OK.code).send(csv);
};
export const notifySignupsController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const payload = notifySignupsSchema.parse(req.body);
  respond(req, res, HttpStatusCodes.OK, NotificationMessages.notified,
    await notifySignupsService(payload.course_id, payload.signed_up_before));
};
export const listTopicsController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  respond(req, res, HttpStatusCodes.OK, NotificationMessages.topics_listed,
    await listTopicRequestsService());
};
export const deleteSubscriberController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const { email } = deleteSubscriberSchema.parse(req.query);
  await deleteSubscriberService(email);
  res.status(HttpStatusCodes.NO_CONTENT.code).send();
};
