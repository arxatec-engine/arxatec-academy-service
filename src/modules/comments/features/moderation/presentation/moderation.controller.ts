import type { Request, Response } from 'express';

import { HttpStatusCodes, type HttpStatus } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import {
  moderationIdSchema, moderationQuerySchema, moderationReplySchema, moderationStatusSchema,
} from '@/modules/comments/features/moderation/domain/moderation.schema';
import {
  deleteModerationService, getModerationCountsService, listModerationService,
  replyModerationService, updateModerationStatusService,
} from '@/modules/comments/features/moderation/presentation/moderation.service';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { buildHttpResponse } from '@/utils/build_http_response';

const respond = (req: Request, res: Response, status: HttpStatus, description: string, data: unknown): void => {
  res.status(status.code).json(buildHttpResponse({ status, description, path: req.originalUrl, data }));
};

export const listModerationController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  const query = moderationQuerySchema.parse(req.query);
  respond(req, res, HttpStatusCodes.OK, CommentMessages.moderation.listed, await listModerationService(query));
};
export const getModerationCountsController = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUser(req);
  respond(req, res, HttpStatusCodes.OK, CommentMessages.moderation.counts, await getModerationCountsService());
};
export const replyModerationController = async (req: Request, res: Response): Promise<void> => {
  const user = getAuthenticatedUser(req);
  const { id } = moderationIdSchema.parse(req.params);
  const { body } = moderationReplySchema.parse(req.body);
  respond(req, res, HttpStatusCodes.CREATED, CommentMessages.moderation.replied,
    await replyModerationService(id, user.id, body));
};
export const updateModerationStatusController = async (req: Request, res: Response): Promise<void> => {
  const user = getAuthenticatedUser(req);
  const { id } = moderationIdSchema.parse(req.params);
  const { status } = moderationStatusSchema.parse(req.body);
  respond(req, res, HttpStatusCodes.OK, CommentMessages.moderation.updated,
    await updateModerationStatusService(id, status, user.id));
};
export const deleteModerationController = async (req: Request, res: Response): Promise<void> => {
  const user = getAuthenticatedUser(req);
  const { id } = moderationIdSchema.parse(req.params);
  respond(req, res, HttpStatusCodes.OK, CommentMessages.moderation.deleted,
    await deleteModerationService(id, user.id));
};
