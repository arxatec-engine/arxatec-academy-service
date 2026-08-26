import type { comment_status, user_role } from '@/generated/enums';

export interface CommentAuthorRecord {
  full_name: string;
  avatar_url: string | null;
  organization: string | null;
  is_independent: boolean;
  role: user_role;
}

export interface CommentRecord {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: Date;
  user: CommentAuthorRecord | null;
}

export interface CommentRefRecord {
  id: string;
  lesson_id: string;
  parent_id: string | null;
  status: comment_status;
}

export interface ApiCommentAuthor {
  full_name: string;
  avatar_url: string | null;
  affiliation: string | null;
  is_team: boolean;
}

export interface ApiComment {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  author: ApiCommentAuthor | null;
}

export interface ApiCommentThread extends ApiComment {
  replies: readonly ApiComment[];
}
