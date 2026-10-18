import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app/create_app';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { AuthHeaders } from '@/constants/auth';
import { AdminRoutePrefix, ApiPrefix, NotificationsRoutePrefix } from '@/constants/endpoints';
import { user_city, user_role } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';
import { postJson, sessionDataSchema } from './helpers/auth_client';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));
const publicRoot = `${ApiPrefix}${NotificationsRoutePrefix}`;
const adminRoot = `${ApiPrefix}${AdminRoutePrefix}${NotificationsRoutePrefix}`;
const suffix = Date.now().toString(36);
const email = `avisos-${suffix}@example.test`;
const adminEmail = `avisos-admin-${suffix}@example.test`;
const envelope = z.object({ data: z.unknown().optional() });
let app: Express;
let token = '';
const auth = () => ({ [AuthHeaders.authorization]: `${AuthHeaders.bearer_prefix}${token}` });

beforeAll(async () => {
  app = createApp();
  jest.mocked(sendEmail).mockResolvedValue(undefined);
  const admin = sessionDataSchema.parse((await postJson(app, 'register', {
    full_name: 'Admin avisos', email: adminEmail, password: 'claveLargaDePrueba',
    is_independent: true, city: user_city.LIMA,
  })).body.data);
  token = admin.token;
  await prisma.users.update({ where: { id: admin.user.id },
    data: { role: user_role.ADMIN }, select: { id: true } });
});

afterAll(async () => {
  await prisma.notification_signups.deleteMany({ where: { email } });
  await prisma.topic_requests.deleteMany({ where: { email } });
  await prisma.users.deleteMany({ where: { email: adminEmail } });
  await disconnectPrisma();
});

it('deduplica avisos y agrupa temas, exporta y marca con corte', async () => {
  const first = await request(app).post(`${publicRoot}/signups`).send({ email: email.toUpperCase() });
  const second = await request(app).post(`${publicRoot}/signups`).send({ email });
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(envelope.parse(first.body).data).toBeUndefined();
  expect(await prisma.notification_signups.count({ where: { email } })).toBe(1);

  const topic = await request(app).post(`${publicRoot}/topics`).send({
    email, search_term: 'Arbitraje Internacional',
  });
  expect(topic.status).toBe(200);
  await request(app).post(`${publicRoot}/topics`).send({ email, search_term: 'arbitraje internacional' });
  const stored = await prisma.topic_requests.findFirstOrThrow({ where: { email },
    select: { request_count: true } });
  expect(stored.request_count).toBe(2);

  const list = await request(app).get(`${adminRoot}/signups?notified=false`).set(auth());
  expect(list.status).toBe(200);
  const exportResponse = await request(app).get(`${adminRoot}/signups/export?notified=false`).set(auth());
  expect(exportResponse.status).toBe(200);
  expect(String(exportResponse.text)).toContain(email);

  const before = new Date().toISOString();
  const notify = await request(app).post(`${adminRoot}/signups/notify`).set(auth())
    .send({ course_id: null, signed_up_before: before });
  expect(notify.status).toBe(200);
  const count = z.object({ marked: z.number() }).parse(envelope.parse(notify.body).data);
  expect(count.marked).toBeGreaterThanOrEqual(1);
  const again = await request(app).post(`${adminRoot}/signups/notify`).set(auth())
    .send({ course_id: null, signed_up_before: before });
  expect(z.object({ marked: z.number() }).parse(envelope.parse(again.body).data).marked).toBe(0);

  const deleted = await request(app).delete(`${adminRoot}/subscribers`).query({ email }).set(auth());
  expect(deleted.status).toBe(204);
  expect(await prisma.notification_signups.count({ where: { email } })).toBe(0);
  expect(await prisma.topic_requests.count({ where: { email } })).toBe(0);
});
