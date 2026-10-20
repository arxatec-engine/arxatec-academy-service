import { prisma } from '@/config/prisma_client';
import type { Prisma } from '@/generated/client';
import { comment_status, user_role } from '@/generated/enums';

const MODERATION_SELECT = {
  id: true, body: true, status: true, created_at: true, parent_id: true,
  user: { select: { full_name: true, avatar_url: true, avatar_key: true, role: true } },
  parent: { select: { status: true } },
  lesson: { select: { slug: true, title: true, position: true,
    course: { select: { slug: true, title: true } } } },
} as const satisfies Prisma.commentsSelect;

const unansweredWhere = {
  parent_id: null,
  user: { role: { not: user_role.ADMIN } },
  replies: { none: { status: comment_status.VISIBLE, user: { role: user_role.ADMIN } } },
} as const;

const unreviewedWhere = { reports: { some: { reviewed_at: null } } } as const;

export const moderationCounts = async () => {
  const [pending, reported] = await Promise.all([
    prisma.comments.count({ where: { status: comment_status.VISIBLE,
      OR: [unreviewedWhere, unansweredWhere] } }),
    prisma.comments.count({ where: { status: comment_status.VISIBLE, ...unreviewedWhere } }),
  ]);
  return { pending, reported };
};

export const moderationPage = async (tab: 'recent' | 'reported' | 'hidden', page: number, page_size: number) => {
  const skip = (page - 1) * page_size;
  let ids: string[];
  let total: number;
  if (tab === 'reported') {
    const groups = await prisma.comment_reports.groupBy({
      by: ['comment_id'], where: { reviewed_at: null, comment: { status: comment_status.VISIBLE } },
      _min: { created_at: true }, orderBy: { _min: { created_at: 'asc' } },
      skip, take: page_size,
    });
    ids = groups.map((group) => group.comment_id);
    total = await prisma.comments.count({ where: { status: comment_status.VISIBLE, ...unreviewedWhere } });
  } else {
    const where: Prisma.commentsWhereInput = tab === 'hidden'
      ? { status: comment_status.HIDDEN }
      : { status: comment_status.VISIBLE, user: { role: { not: user_role.ADMIN } } };
    const [rows, count] = await Promise.all([
      prisma.comments.findMany({ where, select: { id: true }, skip, take: page_size,
        orderBy: tab === 'hidden'
          ? [{ hidden_at: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }, { id: 'desc' }]
          : [{ created_at: 'desc' }, { id: 'desc' }] }),
      prisma.comments.count({ where }),
    ]);
    ids = rows.map((row) => row.id);
    total = count;
  }
  if (ids.length === 0) {return { rows: [], answered: new Set<string>(), reports: new Map<string, number>(), total };}
  const [rows, replies, reports] = await Promise.all([
    prisma.comments.findMany({ where: { id: { in: ids } }, select: MODERATION_SELECT }),
    prisma.comments.findMany({ where: {
      parent_id: { in: ids }, status: comment_status.VISIBLE, user: { role: user_role.ADMIN },
    }, select: { parent_id: true }, distinct: ['parent_id'] }),
    prisma.comment_reports.groupBy({ by: ['comment_id'],
      where: { comment_id: { in: ids }, reviewed_at: null }, _count: { _all: true } }),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    rows: ids.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => row !== undefined),
    answered: new Set(replies.map((reply) => reply.parent_id).filter((id): id is string => id !== null)),
    reports: new Map(reports.map((report) => [report.comment_id, report._count._all])), total,
  };
};

export const findModerationTarget = (id: string) => prisma.comments.findUnique({
  where: { id }, select: { id: true, lesson_id: true, parent_id: true, status: true,
    hidden_at: true, deleted_at: true },
});

export const createModerationReply = (lesson_id: string, parent_id: string, user_id: string, body: string) =>
  prisma.comments.create({ data: { lesson_id, parent_id, user_id, body },
    select: { id: true, parent_id: true, body: true, created_at: true } });

export const setModerationStatus = (id: string, status: 'VISIBLE' | 'HIDDEN', actor: string,
  previous: { status: comment_status; hidden_at: Date | null }) => prisma.$transaction(async (tx) => {
  await tx.comments.update({ where: { id }, data: {
    status,
    ...(status === comment_status.HIDDEN && previous.status !== comment_status.HIDDEN
      ? { hidden_at: new Date(), hidden_by_user_id: actor } : {}),
  }, select: { id: true } });
  await tx.comment_reports.updateMany({ where: { comment_id: id, reviewed_at: null },
    data: { reviewed_at: new Date(), reviewed_by_user_id: actor } });
});

export const deleteModerationComment = (id: string, actor: string, alreadyDeleted: boolean) =>
  prisma.$transaction(async (tx) => {
    if (!alreadyDeleted) {
      await tx.comments.update({ where: { id }, data: {
        status: comment_status.DELETED, deleted_at: new Date(), deleted_by_user_id: actor,
      }, select: { id: true } });
    }
    await tx.comment_reports.updateMany({ where: { comment_id: id, reviewed_at: null },
      data: { reviewed_at: new Date(), reviewed_by_user_id: actor } });
  });
