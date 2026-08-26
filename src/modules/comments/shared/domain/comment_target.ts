import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { comment_status } from '@/generated/enums';
import { findCommentRefById } from '@/modules/comments/shared/data/comments.repository';
import type { CommentRefRecord } from '@/modules/comments/shared/domain/comment.types';
import { AppError } from '@/utils/errors';

const notFound = (): AppError =>
  new AppError(CommentMessages.thread.not_found, HttpStatusCodes.NOT_FOUND.code, {
    code: ErrorCodes.NOT_FOUND,
  });

export const requireComment = async (comment_id: string): Promise<CommentRefRecord> => {
  const comment = await findCommentRefById(comment_id);

  if (comment === null) {
    throw notFound();
  }

  return comment;
};

export const requireRootComment = async (comment_id: string): Promise<CommentRefRecord> => {
  const comment = await requireComment(comment_id);

  if (comment.status !== comment_status.VISIBLE) {
    throw notFound();
  }

  if (comment.parent_id !== null) {
    throw new AppError(
      CommentMessages.thread.reply_not_allowed,
      HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      { code: ErrorCodes.VALIDATION_ERROR },
    );
  }

  return comment;
};
