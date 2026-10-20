import { CommentMessages } from '@/constants/messages/comments';
import { user_role } from '@/generated/enums';
import type { FileUrlResolver } from '@/infrastructure/storage/storage.types';
import type {
  ApiComment,
  ApiCommentAuthor,
  CommentAuthorRecord,
  CommentRecord,
} from '@/modules/comments/shared/domain/comment.types';

const readAffiliation = (author: CommentAuthorRecord): string | null => {
  const organization = author.organization?.trim() ?? '';

  if (organization.length > 0) {
    return organization;
  }

  return author.is_independent ? CommentMessages.author.independent : null;
};

export const toApiCommentAuthor = (
  author: CommentAuthorRecord | null,
  resolveFileUrl: FileUrlResolver,
): ApiCommentAuthor | null =>
  author === null
    ? null
    : {
        full_name: author.full_name,
        avatar_url: resolveFileUrl(author.avatar_url, author.avatar_key),
        affiliation: readAffiliation(author),
        is_team: author.role === user_role.ADMIN,
      };

export const toApiComment = (
  comment: CommentRecord,
  resolveFileUrl: FileUrlResolver,
): ApiComment => ({
  id: comment.id,
  parent_id: comment.parent_id,
  body: comment.body,
  created_at: comment.created_at.toISOString(),
  author: toApiCommentAuthor(comment.user, resolveFileUrl),
});
