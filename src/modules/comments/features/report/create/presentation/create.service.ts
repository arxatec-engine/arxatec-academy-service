import type { CreateCommentReportPayload } from '@/modules/comments/features/report/create/domain/create.payload';
import { createCommentReport } from '@/modules/comments/shared/data/comments.repository';
import { requireComment } from '@/modules/comments/shared/domain/comment_target';

export const createCommentReportService = async (
  payload: CreateCommentReportPayload,
): Promise<void> => {
  const comment = await requireComment(payload.comment_id);

  await createCommentReport({
    comment_id: comment.id,
    reported_by_user_id: payload.user_id,
    reason: payload.reason,
  });
};
