import { prisma } from '@/config/prisma_client';
import type { Prisma } from '@/generated/client';
import { comment_status } from '@/generated/enums';
import type {
  CommentRecord,
  CommentRefRecord,
} from '@/modules/comments/shared/domain/comment.types';

const COMMENT_AUTHOR_SELECT = {
  full_name: true,
  avatar_url: true,
  organization: true,
  is_independent: true,
  role: true,
} as const satisfies Prisma.usersSelect;

const COMMENT_SELECT = {
  id: true,
  parent_id: true,
  body: true,
  created_at: true,
  user: { select: COMMENT_AUTHOR_SELECT },
} as const satisfies Prisma.commentsSelect;

const COMMENT_REF_SELECT = {
  id: true,
  lesson_id: true,
  parent_id: true,
  status: true,
} as const satisfies Prisma.commentsSelect;

export interface CreateCommentInput {
  lesson_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
}

export interface CreateCommentReportInput {
  comment_id: string;
  reported_by_user_id: string;
  reason: string | null;
}

export const findVisibleCommentsByLesson = async (
  lesson_id: string,
): Promise<readonly CommentRecord[]> =>
  prisma.comments.findMany({
    where: { lesson_id, status: comment_status.VISIBLE },
    select: COMMENT_SELECT,
    orderBy: { created_at: 'asc' },
  });

export const findCommentRefById = async (comment_id: string): Promise<CommentRefRecord | null> =>
  prisma.comments.findUnique({ where: { id: comment_id }, select: COMMENT_REF_SELECT });

export const createComment = async ({
  lesson_id,
  user_id,
  parent_id,
  body,
}: CreateCommentInput): Promise<CommentRecord> =>
  prisma.comments.create({
    data: { lesson_id, user_id, parent_id, body },
    select: COMMENT_SELECT,
  });

export const createCommentReport = async ({
  comment_id,
  reported_by_user_id,
  reason,
}: CreateCommentReportInput): Promise<void> => {
  await prisma.comment_reports.createMany({
    data: { comment_id, reported_by_user_id, reason },
    skipDuplicates: true,
  });
};

export const deleteUserComments = async (
  user_id: string,
  client: Prisma.TransactionClient = prisma,
): Promise<void> => {
  await client.comment_reports.deleteMany({ where: { reported_by_user_id: user_id } });
  await client.comments.deleteMany({ where: { user_id } });
};
