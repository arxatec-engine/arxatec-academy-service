import type { ApiCommentThread } from '@/modules/comments/shared/domain/comment.types';

export interface GetCommentsResult {
  comments: readonly ApiCommentThread[];
}
