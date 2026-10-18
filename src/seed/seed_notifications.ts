import { createHash } from 'node:crypto';

import type { PrismaClient } from '@/generated/client';
import { user_role } from '@/generated/enums';
import { normalizeForSearch } from '@/utils/normalize_search';

export interface SeedNotificationUser {
  id: string;
  email: string;
  role: user_role;
}

interface SeedNotificationCourse {
  id: string;
  slug: string;
}

interface SeedSignup {
  id: string;
  email: string;
  course_id: string | null;
  user_id: string | null;
  notified_at: Date | null;
  created_at: Date;
}

interface SeedTopicRequest {
  id: string;
  email: string;
  search_term: string;
  search_term_normalized: string;
  request_count: number;
  user_id: string | null;
  created_at: Date;
  last_requested_at: Date;
}

const TOPICS = [
  'Inteligencia artificial para abogados',
  'Automatización de contratos',
  'Firma digital y documentos electrónicos',
  'Protección de datos personales',
  'Gestión de expedientes',
  'Legal design',
  'ChatGPT en el estudio jurídico',
  'Prueba digital y evidencia electrónica',
  'Litigación oral',
  'Gestión de estudios jurídicos',
] as const;

const seedId = (kind: string, values: readonly (string | null)[]): string =>
  `seed_${kind}_${createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 40)}`;

const signupKey = (signup: Pick<SeedSignup, 'email' | 'course_id'>): string =>
  JSON.stringify([signup.email, signup.course_id]);

export const buildSeedNotifications = (
  users: readonly SeedNotificationUser[],
  courses: readonly SeedNotificationCourse[],
  now = new Date(),
): { signups: SeedSignup[]; topicRequests: SeedTopicRequest[] } => {
  if (courses.length === 0) {
    throw new Error('La semilla de avisos necesita al menos un curso.');
  }

  const orderedCourses = courses.toSorted((left, right) => left.slug.localeCompare(right.slug));
  const people = [
    ...users
      .filter((user) => user.role === user_role.STUDENT)
      .toSorted((left, right) => left.email.localeCompare(right.email))
      .slice(0, 24)
      .map((user) => ({ email: user.email, user_id: user.id })),
    ...Array.from({ length: 6 }, (_, index) => ({
      email: `visitante${String(index + 1).padStart(2, '0')}@seed.arxatec.test`,
      user_id: null,
    })),
  ];
  const daysAgo = (days: number): Date => new Date(now.getTime() - days * 86_400_000);
  const signups: SeedSignup[] = [];
  const topicRequests: SeedTopicRequest[] = [];

  for (const [index, person] of people.entries()) {
    const course = orderedCourses[index % orderedCourses.length];

    for (const [scope, course_id] of [null, course.id].entries()) {
      const created_at = daysAgo(1 + ((index * 2 + scope) % 30));
      const notified = (index + scope + Math.floor(index / orderedCourses.length)) % 2 === 0;

      signups.push({
        ...person,
        id: seedId('notice', [person.email, course_id]),
        course_id,
        created_at,
        notified_at: notified ? new Date(created_at.getTime() + 6 * 60 * 60 * 1000) : null,
      });
    }
  }

  for (const [topicIndex, search_term] of TOPICS.entries()) {
    const search_term_normalized = normalizeForSearch(search_term);
    const participants = Math.min(3 + (topicIndex % 5), people.length);

    for (let index = 0; index < participants; index += 1) {
      const person = people[(topicIndex * 3 + index) % people.length];

      topicRequests.push({
        ...person,
        id: seedId('topic', [person.email, search_term_normalized]),
        search_term,
        search_term_normalized,
        request_count: 1 + ((topicIndex * 2 + index) % 5),
        created_at: daysAgo(30 + topicIndex + index),
        last_requested_at: daysAgo(1 + ((topicIndex + index) % 14)),
      });
    }
  }

  return { signups, topicRequests };
};

export const seedNotifications = async (
  client: PrismaClient,
  users: readonly SeedNotificationUser[],
  courses: readonly SeedNotificationCourse[],
) => {
  const { signups, topicRequests } = buildSeedNotifications(users, courses);

  return client.$transaction(async (transaction) => {
    const existing = await transaction.notification_signups.findMany({
      where: { email: { in: [...new Set(signups.map((signup) => signup.email))] } },
      select: { email: true, course_id: true },
    });
    const existingKeys = new Set(existing.map(signupKey));
    const savedSignups = await transaction.notification_signups.createMany({
      data: signups.filter((signup) => !existingKeys.has(signupKey(signup))),
      skipDuplicates: true,
    });
    const savedTopics = await transaction.topic_requests.createMany({
      data: topicRequests,
      skipDuplicates: true,
    });

    return { signups_created: savedSignups.count, topic_requests_created: savedTopics.count };
  });
};
