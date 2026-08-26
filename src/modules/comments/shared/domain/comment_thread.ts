import type {
  ApiComment,
  ApiCommentThread,
  CommentRecord,
} from '@/modules/comments/shared/domain/comment.types';
import { toApiComment } from '@/modules/comments/shared/domain/comment_mapper';

export const buildThreads = (comments: readonly CommentRecord[]): readonly ApiCommentThread[] => {
  const threads: ApiCommentThread[] = [];
  const replies_by_root = new Map<string, ApiComment[]>();

  for (const comment of comments) {
    if (comment.parent_id === null) {
      const replies: ApiComment[] = [];

      replies_by_root.set(comment.id, replies);
      threads.push({ ...toApiComment(comment), replies });
    }
  }

  for (const comment of comments) {
    if (comment.parent_id !== null) {
      replies_by_root.get(comment.parent_id)?.push(toApiComment(comment));
    }
  }

  return threads;
};
