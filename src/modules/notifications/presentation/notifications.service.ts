import type { z } from 'zod';

import { env } from '@/config/env';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { NotificationMessages } from '@/constants/messages/notifications';
import { ValidationKeys } from '@/constants/validation_keys';
import { hashOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  countSignups, deleteSubscriber, findAccountEmails, findPublishedCourseForSignup,
  findSignups, findTopicRequests, insertSignup, markSignupsNotified, upsertTopicRequest,
} from '@/modules/notifications/shared/data/notifications.repository';
import type {
  createSignupSchema, createTopicSchema, signupFiltersSchema, signupListSchema,
} from '@/modules/notifications/shared/domain/notification.schema';
import type { AuthenticatedUser } from '@/types/authenticated_user';
import { writeCsv } from '@/utils/csv';
import { AppError } from '@/utils/errors';
import { normalizeForSearch } from '@/utils/normalize_search';
import { reportingDay } from '@/utils/reporting_date';

const emailFor = (user: AuthenticatedUser | null, email: string | undefined): string => {
  const resolved = user?.email ?? email;
  if (resolved === undefined) {
    throw new AppError(NotificationMessages.signup_created, HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      { code: ErrorCodes.VALIDATION_ERROR, fields: { email: ValidationKeys.common.required } });
  }
  return resolved;
};
const ipHash = (ip: string | undefined): string | null =>
  ip === undefined ? null : hashOneTimeToken(`${env.NOTIFICATIONS_IP_HASH_SALT}:${ip}`);

export const createSignupService = async (payload: z.infer<typeof createSignupSchema>,
  user: AuthenticatedUser | null, ip: string | undefined): Promise<void> => {
  let course_id: string | null = null;
  if (payload.course_slug !== undefined) {
    const course = await findPublishedCourseForSignup(payload.course_slug);
    if (course === null) {throw new AppError(NotificationMessages.course_not_found,
      HttpStatusCodes.NOT_FOUND.code, { code: ErrorCodes.NOT_FOUND });}
    course_id = course.id;
  }
  await insertSignup({ email: emailFor(user, payload.email), course_id,
    user_id: user?.id ?? null, ip_hash: ipHash(ip) });
};

export const createTopicRequestService = async (payload: z.infer<typeof createTopicSchema>,
  user: AuthenticatedUser | null, ip: string | undefined): Promise<void> => {
  await upsertTopicRequest({
    email: emailFor(user, payload.email), search_term: payload.search_term,
    search_term_normalized: normalizeForSearch(payload.search_term),
    user_id: user?.id ?? null, ip_hash: ipHash(ip),
  });
};

export const listSignupsService = async (query: z.infer<typeof signupListSchema>) => {
  const { page, per_page, ...filters } = query;
  const [rows, total] = await Promise.all([
    findSignups(filters, page, per_page), countSignups(filters),
  ]);
  const accounts = new Set((await findAccountEmails(rows.map((row) => row.email)))
    .map((row) => row.email));
  return { signups: rows.map((row) => ({
    id: row.id, email: row.email, course: row.course,
    created_at: row.created_at.toISOString(),
    notified_at: row.notified_at?.toISOString() ?? null,
    has_account: accounts.has(row.email),
  })), pagination: { page, per_page, total, has_next: page * per_page < total } };
};

export const exportSignupsService = async (filters: z.infer<typeof signupFiltersSchema>) => {
  const rows = await findSignups(filters);
  return writeCsv([NotificationMessages.csv_header,
    ...rows.map((row) => [row.email, row.course?.title ?? NotificationMessages.catalog,
      reportingDay(row.created_at), row.notified_at ? reportingDay(row.notified_at) : ''])]);
};

export const notifySignupsService = async (course_id: string | null, before: Date) => {
  const result = await markSignupsNotified(course_id, before);
  return { marked: result.count };
};

export const listTopicRequestsService = async () => {
  const rows = await findTopicRequests();
  const groups = new Map<string, { search_term: string; search_term_normalized: string;
    request_count: number; emails: Set<string>; last_requested_at: Date }>();
  for (const row of rows) {
    const current = groups.get(row.search_term_normalized);
    if (current === undefined) {
      groups.set(row.search_term_normalized, { search_term: row.search_term,
        search_term_normalized: row.search_term_normalized, request_count: row.request_count,
        emails: new Set([row.email]), last_requested_at: row.last_requested_at });
    } else {
      current.request_count += row.request_count;
      current.emails.add(row.email);
      if (row.last_requested_at > current.last_requested_at) {current.last_requested_at = row.last_requested_at;}
    }
  }
  return { topics: [...groups.values()].sort((a, b) => b.request_count - a.request_count)
    .map((group) => ({ search_term: group.search_term,
      search_term_normalized: group.search_term_normalized,
      request_count: group.request_count, distinct_emails: group.emails.size,
      last_requested_at: group.last_requested_at.toISOString() })) };
};

export const deleteSubscriberService = async (email: string): Promise<void> => {
  if (await deleteSubscriber(email) === 0) {
    throw new AppError(NotificationMessages.subscriber_not_found,
      HttpStatusCodes.NOT_FOUND.code, { code: ErrorCodes.NOT_FOUND });
  }
};
