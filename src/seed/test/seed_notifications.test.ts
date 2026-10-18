import type { PrismaClient } from '@/generated/client';
import { user_role } from '@/generated/enums';
import { buildSeedNotifications, seedNotifications } from '@/seed/seed_notifications';

const users = Array.from({ length: 24 }, (_, index) => ({
  id: `student-${index + 1}`,
  email: `student${String(index + 1).padStart(2, '0')}@example.test`,
  role: user_role.STUDENT,
}));
const courses = Array.from({ length: 6 }, (_, index) => ({
  id: `course-${index + 1}`,
  slug: `curso-${index + 1}`,
}));
const now = new Date('2026-10-17T20:00:00.000Z');

describe('semilla de avisos y temas solicitados', () => {
  it('permite revisar ambos estados, cursos, catálogo general, usuarios y visitantes', () => {
    const { signups } = buildSeedNotifications(users, courses, now);

    expect(signups).toHaveLength(60);
    expect(signups.filter((signup) => signup.course_id === null)).toHaveLength(30);
    expect(signups.filter((signup) => signup.notified_at === null)).toHaveLength(30);
    expect(signups.filter((signup) => signup.user_id === null)).toHaveLength(12);
    expect(new Set(signups.flatMap((signup) => signup.course_id ?? []))).toHaveProperty('size', 6);
    for (const signup of signups) {
      expect(signup.created_at.getTime()).toBeLessThan(now.getTime());
      if (signup.notified_at !== null) {
        expect(signup.notified_at.getTime()).toBeGreaterThan(signup.created_at.getTime());
        expect(signup.notified_at.getTime()).toBeLessThan(now.getTime());
      }
    }
  });

  it('agrupa varios correos y solicitudes bajo diez temas normalizados', () => {
    const { topicRequests } = buildSeedNotifications(users, courses, now);
    const grouped = new Map<string, typeof topicRequests>();

    for (const topic of topicRequests) {
      grouped.set(topic.search_term_normalized, [
        ...(grouped.get(topic.search_term_normalized) ?? []),
        topic,
      ]);
      expect(topic.request_count).toBeGreaterThan(0);
      expect(topic.last_requested_at.getTime()).toBeGreaterThan(topic.created_at.getTime());
      expect(topic.last_requested_at.getTime()).toBeLessThan(now.getTime());
    }

    expect(topicRequests).toHaveLength(50);
    expect(grouped.size).toBe(10);
    expect(grouped.has('proteccion de datos personales')).toBe(true);
    for (const requests of grouped.values()) {
      expect(new Set(requests.map((request) => request.email)).size).toBe(requests.length);
      expect(requests.length).toBeGreaterThan(1);
    }
  });

  it('conserva identidades únicas aunque cambien la fecha o el orden de usuarios y cursos', () => {
    const initial = buildSeedNotifications(users, courses, now);
    const repeated = buildSeedNotifications(
      [...users].reverse(),
      [...courses].reverse(),
      new Date('2026-10-18T20:00:00.000Z'),
    );

    expect(repeated.signups.map((signup) => signup.id)).toEqual(
      initial.signups.map((signup) => signup.id),
    );
    expect(repeated.topicRequests.map((topic) => topic.id)).toEqual(
      initial.topicRequests.map((topic) => topic.id),
    );
    expect(new Set(initial.signups.map((signup) => signup.id)).size).toBe(60);
    expect(new Set(initial.topicRequests.map((topic) => topic.id)).size).toBe(50);
  });

  it('requiere cursos antes de generar suscripciones', () => {
    expect(() => buildSeedNotifications(users, [], now)).toThrow(
      'La semilla de avisos necesita al menos un curso.',
    );
  });

  it('respeta una suscripción general existente e inserta solo los registros que faltan', async () => {
    const existing = { email: users[0].email, course_id: null };
    const transaction = {
      notification_signups: {
        findMany: jest.fn().mockResolvedValue([existing]),
        createMany: jest.fn().mockResolvedValue({ count: 59 }),
      },
      topic_requests: {
        createMany: jest.fn().mockResolvedValue({ count: 50 }),
      },
    };
    const client = {
      $transaction: jest.fn((work: (value: typeof transaction) => Promise<unknown>) =>
        work(transaction),
      ),
    } as unknown as PrismaClient;

    await expect(seedNotifications(client, users, courses)).resolves.toEqual({
      signups_created: 59,
      topic_requests_created: 50,
    });
    expect(transaction.notification_signups.createMany).toHaveBeenCalledWith({
      data: expect.not.arrayContaining([expect.objectContaining(existing)]),
      skipDuplicates: true,
    });
    expect(transaction.notification_signups.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ email: users[1].email, course_id: null }),
      ]),
      skipDuplicates: true,
    });
    expect(transaction.topic_requests.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ search_term_normalized: 'proteccion de datos personales' }),
      ]),
      skipDuplicates: true,
    });
  });
});
