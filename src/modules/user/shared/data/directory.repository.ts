import type { z } from 'zod';

import { prisma } from '@/config/prisma_client';
import type { Prisma } from '@/generated/client';
import type { directoryFiltersSchema } from '@/modules/user/shared/domain/directory_filters.schema';

export type DirectoryFilters = z.infer<typeof directoryFiltersSchema>;

const USER_SELECT = {
  id: true, full_name: true, email: true, organization: true,
  is_independent: true, city: true, city_other: true,
  created_at: true, email_verified_at: true,
} as const satisfies Prisma.usersSelect;

const normalize = (value: string): string => value.normalize('NFD')
  .replace(/\p{Diacritic}/gu, '').toLowerCase();

const whereFor = async (filters: DirectoryFilters): Promise<Prisma.usersWhereInput> => {
  const where: Prisma.usersWhereInput = {};
  if (filters.search) {
    const candidates = await prisma.users.findMany({
      select: { id: true, full_name: true, email: true, organization: true },
    });
    const needle = normalize(filters.search);
    where.id = { in: candidates.filter((row) =>
      [row.full_name, row.email, row.organization ?? ''].some((value) => normalize(value).includes(needle)))
      .map((row) => row.id) };
  }
  if (filters.city.length) {where.city = { in: filters.city };}
  if (filters.registered_from || filters.registered_to) {where.created_at = {
    ...(filters.registered_from ? { gte: filters.registered_from } : {}),
    ...(filters.registered_to ? { lt: new Date(filters.registered_to.getTime() + 86_400_000) } : {}),
  };}
  if (filters.is_independent !== undefined) {where.is_independent = filters.is_independent;}
  if (filters.email_verified !== undefined) {where.email_verified_at = filters.email_verified
    ? { not: null } : null;}
  const enrollmentFilters: Prisma.usersWhereInput[] = [];
  if (filters.has_completed !== undefined) {
    enrollmentFilters.push({ enrollments: filters.has_completed
      ? { some: { completed_at: { not: null } } }
      : { none: { completed_at: { not: null } } } });
  }
  if (filters.completed_topic.length) {
    enrollmentFilters.push({ enrollments: {
      some: { completed_at: { not: null }, course: { topic: { in: filters.completed_topic } } },
    } });
  }
  if (enrollmentFilters.length > 0) {where.AND = enrollmentFilters;}
  return where;
};

const orderFor = (filters: DirectoryFilters): Prisma.usersOrderByWithRelationInput[] =>
  filters.sort === 'full_name'
    ? [{ full_name: 'asc' }, { id: 'asc' }]
    : [{ created_at: 'desc' }, { id: 'desc' }];

export const countDirectory = async (filters: DirectoryFilters): Promise<number> =>
  prisma.users.count({ where: await whereFor(filters) });

export const findDirectoryPage = async (filters: DirectoryFilters, page: number, per_page: number) =>
  prisma.users.findMany({ where: await whereFor(filters), select: USER_SELECT,
    orderBy: orderFor(filters), skip: (page - 1) * per_page, take: per_page });

export const findDirectoryAll = async (filters: DirectoryFilters) =>
  prisma.users.findMany({ where: await whereFor(filters), select: USER_SELECT,
    orderBy: orderFor(filters) });

export const countDirectoryStats = async (week_start: Date) => {
  const [total_registered, registered_this_week] = await Promise.all([
    prisma.users.count(), prisma.users.count({ where: { created_at: { gte: week_start } } }),
  ]);
  return { total_registered, registered_this_week, week_start: week_start.toISOString() };
};

export const completedCourseCounts = async (ids: readonly string[]) => {
  if (ids.length === 0) {return new Map<string, number>();}
  const rows = await prisma.enrollments.groupBy({ by: ['user_id'],
    where: { user_id: { in: [...ids] }, completed_at: { not: null } },
    _count: { _all: true } });
  return new Map(rows.map((row) => [row.user_id, row._count._all]));
};
