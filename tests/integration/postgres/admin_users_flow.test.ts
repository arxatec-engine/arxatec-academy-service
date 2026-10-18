import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app/create_app';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { AuthHeaders } from '@/constants/auth';
import { AdminRoutePrefix, AdminUsersEndpoints, ApiPrefix } from '@/constants/endpoints';
import { user_city, user_role } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';
import { postJson, sessionDataSchema } from './helpers/auth_client';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));
const root = `${ApiPrefix}${AdminRoutePrefix}${AdminUsersEndpoints.list}`;
const exportPath = `${ApiPrefix}${AdminRoutePrefix}${AdminUsersEndpoints.export}`;
const suffix = Date.now().toString(36);
const adminEmail = `directory-admin-${suffix}@example.test`;
const targetEmail = `directory-target-${suffix}@example.test`;
const envelope = z.object({ data: z.unknown().optional(), meta: z.object({
  pagination: z.object({ total: z.number() }).optional(), code: z.string().optional(),
}).optional() });
const directory = z.object({ users: z.array(z.object({ email: z.string(), completed_courses: z.number() })),
  stats: z.object({ total_registered: z.number(), registered_this_week: z.number(), week_start: z.string() }) });
let app: Express;
let adminToken = '';
let studentToken = '';
const auth = (token: string) => ({ [AuthHeaders.authorization]: `${AuthHeaders.bearer_prefix}${token}` });

beforeAll(async () => {
  app = createApp();
  jest.mocked(sendEmail).mockResolvedValue(undefined);
  const admin = sessionDataSchema.parse((await postJson(app, 'register', {
    full_name: 'Admin Directorio', email: adminEmail, password: 'claveLargaDePrueba',
    is_independent: true, city: user_city.LIMA,
  })).body.data);
  adminToken = admin.token;
  await prisma.users.update({ where: { id: admin.user.id }, data: { role: user_role.ADMIN }, select: { id: true } });
  const student = sessionDataSchema.parse((await postJson(app, 'register', {
    full_name: 'Ibáñez Prado', email: targetEmail, password: 'claveLargaDePrueba',
    organization: '=1+1', is_independent: false, city: user_city.AREQUIPA,
  })).body.data);
  studentToken = student.token;
});

afterAll(async () => {
  await prisma.users.deleteMany({ where: { email: { in: [adminEmail, targetEmail] } } });
  await disconnectPrisma();
});

it('filtra la lista, deja stats globales y exporta CSV seguro', async () => {
  expect((await request(app).get(root)).status).toBe(401);
  expect((await request(app).get(root).set(auth(studentToken))).status).toBe(403);
  const listResponse = await request(app).get(`${root}?search=Ibanez`).set(auth(adminToken));
  expect(listResponse.status).toBe(200);
  const parsed = envelope.parse(listResponse.body);
  const result = directory.parse(parsed.data);
  expect(result.users.map((row) => row.email)).toContain(targetEmail);
  expect(result.users.find((row) => row.email === targetEmail)?.completed_courses).toBe(0);
  expect(result.stats.total_registered).toBeGreaterThan(parsed.meta?.pagination?.total ?? 0);

  const exported = await request(app).get(`${exportPath}?search=Ibanez&page=3`)
    .set(auth(adminToken)).buffer(true);
  expect(exported.status).toBe(200);
  const csv = String(exported.text);
  expect(csv.startsWith('\uFEFF')).toBe(true);
  expect(csv).toContain('Ibáñez Prado');
  expect(csv).toContain("'=1+1");
  expect(Number(exported.headers['content-length'])).toBe(Buffer.byteLength(csv));
});
