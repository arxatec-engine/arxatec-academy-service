import { resolveStoredFileUrl } from '@/infrastructure/storage/file_url';
import type { ReplyCommentPayload } from '@/modules/comments/features/thread/reply/domain/reply.payload';
import type { ReplyCommentResult } from '@/modules/comments/features/thread/reply/domain/reply.types';
import { createComment } from '@/modules/comments/shared/data/comments.repository';
import { toApiComment } from '@/modules/comments/shared/domain/comment_mapper';
import { requireRootComment } from '@/modules/comments/shared/domain/comment_target';

export const replyCommentService = async (
  payload: ReplyCommentPayload,
): Promise<ReplyCommentResult> => {
  const parent = await requireRootComment(payload.comment_id);
  const comment = await createComment({
    lesson_id: parent.lesson_id,
    user_id: payload.user_id,
    parent_id: parent.id,
    body: payload.body,
  });

  return { comment: toApiComment(comment, resolveStoredFileUrl) };
};
