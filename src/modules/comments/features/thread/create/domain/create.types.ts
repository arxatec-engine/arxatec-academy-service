import type { ApiComment } from '@/modules/comments/shared/domain/comment.types';

export interface CreateCommentResult {
  comment: ApiComment;
}
