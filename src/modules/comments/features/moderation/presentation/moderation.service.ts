import { resolveStoredFileUrl } from '@/infrastructure/storage/file_url';
import type { z } from 'zod';

import { logger } from '@/config/logger';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { comment_status, user_role } from '@/generated/enums';
import type { moderationQuerySchema } from '@/modules/comments/features/moderation/domain/moderation.schema';
import {
  createModerationReply, deleteModerationComment, findModerationTarget,
  moderationCounts, moderationPage, setModerationStatus,
} from '@/modules/comments/shared/data/moderation.repository';
import { AppError } from '@/utils/errors';

const missing = (): AppError => new AppError(CommentMessages.thread.not_found,
  HttpStatusCodes.NOT_FOUND.code, { code: ErrorCodes.NOT_FOUND });

export const getModerationCountsService = async () => ({ counts: await moderationCounts() });

export const listModerationService = async (query: z.infer<typeof moderationQuerySchema>) => {
  const page = await moderationPage(query.tab, query.page, query.page_size);
  const counts = await moderationCounts();
  return {
    comments: page.rows.map((row) => ({
      id: row.id, created_at: row.created_at.toISOString(), status: row.status,
      body: row.body, is_reply: row.parent_id !== null, parent_id: row.parent_id,
      is_answered: row.parent_id === null ? page.answered.has(row.id) : null,
      report_count: page.reports.get(row.id) ?? 0,
      is_public: row.status === comment_status.VISIBLE
        && (row.parent === null || row.parent.status === comment_status.VISIBLE),
      author: row.user === null ? null : {
        full_name: row.user.full_name, avatar_url: resolveStoredFileUrl(row.user.avatar_url, row.user.avatar_key),
        is_team: row.user.role === user_role.ADMIN,
      },
      course: row.lesson.course,
      lesson: { slug: row.lesson.slug, title: row.lesson.title, position: row.lesson.position },
    })),
    counts,
    pagination: { page: query.page, page_size: query.page_size,
      total: page.total, has_next: query.page * query.page_size < page.total },
  };
};

export const replyModerationService = async (id: string, user_id: string, body: string) => {
  const target = await findModerationTarget(id);
  if (target === null) {throw missing();}
  if (target.parent_id !== null || target.status !== comment_status.VISIBLE) {
    throw new AppError(CommentMessages.thread.reply_not_allowed,
      HttpStatusCodes.UNPROCESSABLE_ENTITY.code, { code: ErrorCodes.VALIDATION_ERROR });
  }
  const comment = await createModerationReply(target.lesson_id, id, user_id, body);
  logger.info({ comment_id: id, actor_user_id: user_id, action: 'reply' }, CommentMessages.moderation.replied);
  return { comment: { ...comment, created_at: comment.created_at.toISOString() },
    counts: await moderationCounts() };
};

export const updateModerationStatusService = async (id: string, status: 'VISIBLE' | 'HIDDEN', user_id: string) => {
  const target = await findModerationTarget(id);
  if (target === null) {throw missing();}
  if (target.status === comment_status.DELETED) {
    throw new AppError(CommentMessages.moderation.already_deleted,
      HttpStatusCodes.CONFLICT.code, { code: ErrorCodes.COMMENT_ALREADY_DELETED });
  }
  await setModerationStatus(id, status, user_id, target);
  logger.info({ comment_id: id, actor_user_id: user_id, action: status }, CommentMessages.moderation.updated);
  return { comment: { id, status }, counts: await moderationCounts() };
};

export const deleteModerationService = async (id: string, user_id: string) => {
  const target = await findModerationTarget(id);
  if (target === null) {throw missing();}
  await deleteModerationComment(id, user_id, target.status === comment_status.DELETED);
  logger.info({ comment_id: id, actor_user_id: user_id, action: 'delete' }, CommentMessages.moderation.deleted);
  return { comment: { id, status: comment_status.DELETED }, counts: await moderationCounts() };
};
