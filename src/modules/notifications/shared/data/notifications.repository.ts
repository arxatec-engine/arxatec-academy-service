import { prisma } from '@/config/prisma_client';
import { course_status } from '@/generated/enums';

export const findPublishedCourseForSignup = (slug: string) => prisma.courses.findFirst({
  where: { slug, status: course_status.PUBLISHED }, select: { id: true },
});

export const insertSignup = (data: {
  email: string; course_id: string | null; user_id: string | null; ip_hash: string | null;
}) => prisma.$transaction(async (tx) => {
  await tx.notification_signups.createMany({ data: [data], skipDuplicates: true });
  if (data.user_id !== null) {
    await tx.notification_signups.updateMany({
      where: { email: data.email, course_id: data.course_id, user_id: null },
      data: { user_id: data.user_id },
    });
  }
});

export const upsertTopicRequest = (data: {
  email: string; search_term: string; search_term_normalized: string;
  user_id: string | null; ip_hash: string | null;
}) => prisma.topic_requests.upsert({
  where: { email_search_term_normalized: {
    email: data.email, search_term_normalized: data.search_term_normalized,
  } },
  create: data,
  update: { request_count: { increment: 1 }, last_requested_at: new Date(),
    ...(data.user_id === null ? {} : { user_id: data.user_id }) },
  select: { id: true },
});

export interface SignupFilters { course_id?: string; notified?: boolean }

const signupWhere = (filters: SignupFilters) => ({
  ...(filters.course_id === undefined ? {} : { course_id: filters.course_id }),
  ...(filters.notified === undefined ? {} : { notified_at: filters.notified ? { not: null } : null }),
});

const SIGNUP_SELECT = {
  id: true, email: true, created_at: true, notified_at: true,
  course: { select: { id: true, title: true, slug: true } },
} as const;

export const findSignups = (filters: SignupFilters, page?: number, per_page?: number) =>
  prisma.notification_signups.findMany({ where: signupWhere(filters), select: SIGNUP_SELECT,
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    ...(page === undefined || per_page === undefined ? {} : {
      skip: (page - 1) * per_page, take: per_page,
    }),
  });
export const countSignups = (filters: SignupFilters) =>
  prisma.notification_signups.count({ where: signupWhere(filters) });

export const findAccountEmails = (emails: readonly string[]) => prisma.users.findMany({
  where: { email: { in: [...emails] } }, select: { email: true },
});

export const markSignupsNotified = (course_id: string | null, before: Date) =>
  prisma.notification_signups.updateMany({ where: {
    course_id, notified_at: null, created_at: { lte: before },
  }, data: { notified_at: new Date() } });

export const findTopicRequests = () => prisma.topic_requests.findMany({
  select: { email: true, search_term: true, search_term_normalized: true,
    request_count: true, last_requested_at: true },
});

export const deleteSubscriber = (email: string) => prisma.$transaction(async (tx) => {
  const signups = await tx.notification_signups.deleteMany({ where: { email } });
  const topics = await tx.topic_requests.deleteMany({ where: { email } });
  return signups.count + topics.count;
});
