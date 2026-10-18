import type { Express } from 'express';
import request from 'supertest';

import { createApp } from '@/app/create_app';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { AuthHeaders } from '@/constants/auth';
import { user_city } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';
import { postJson, sessionDataSchema } from './helpers/auth_client';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

const email = `admin-guard-${Date.now().toString(36)}@example.test`;
const paths = [
  ['get', '/api/v1/admin/teachers'],
  ['get', '/api/v1/admin/courses'],
  ['post', '/api/v1/admin/courses'],
  ['put', '/api/v1/admin/courses/order'],
  ['get', '/api/v1/admin/courses/id'],
  ['patch', '/api/v1/admin/courses/id'],
  ['post', '/api/v1/admin/courses/id/publish'],
  ['post', '/api/v1/admin/courses/id/unpublish'],
  ['post', '/api/v1/admin/courses/id/duplicate'],
  ['post', '/api/v1/admin/courses/id/archive'],
  ['put', '/api/v1/admin/courses/id/cover'],
  ['get', '/api/v1/admin/courses/id/exam'],
  ['put', '/api/v1/admin/courses/id/exam'],
  ['get', '/api/v1/admin/courses/id/lessons'],
  ['post', '/api/v1/admin/courses/id/lessons'],
  ['put', '/api/v1/admin/courses/id/lessons/order'],
  ['get', '/api/v1/admin/lessons/id'],
  ['patch', '/api/v1/admin/lessons/id'],
  ['delete', '/api/v1/admin/lessons/id'],
  ['post', '/api/v1/admin/lessons/id/publish'],
  ['delete', '/api/v1/admin/lessons/id/publish'],
  ['post', '/api/v1/admin/lessons/id/resources'],
  ['patch', '/api/v1/admin/lessons/id/resources/id'],
  ['delete', '/api/v1/admin/lessons/id/resources/id'],
  ['put', '/api/v1/admin/lessons/id/resources/order'],
  ['post', '/api/v1/admin/videos/probe'],
  ['get', '/api/v1/admin/comments'],
  ['get', '/api/v1/admin/comments/counts'],
  ['post', '/api/v1/admin/comments/id/replies'],
  ['patch', '/api/v1/admin/comments/id/status'],
  ['delete', '/api/v1/admin/comments/id'],
  ['get', '/api/v1/admin/users'],
  ['get', '/api/v1/admin/users/export'],
  ['get', '/api/v1/admin/notifications/signups'],
  ['get', '/api/v1/admin/notifications/signups/export'],
  ['post', '/api/v1/admin/notifications/signups/notify'],
  ['get', '/api/v1/admin/notifications/topics'],
  ['delete', '/api/v1/admin/notifications/subscribers?email=test@example.test'],
] as const;

let app: Express;
let studentToken = '';

beforeAll(async () => {
  app = createApp();
  jest.mocked(sendEmail).mockResolvedValue(undefined);
  const response = await postJson(app, 'register', {
    full_name: 'Alumno de guardias',
    email,
    password: 'claveLargaDePrueba',
    is_independent: true,
    city: user_city.LIMA,
  });
  studentToken = sessionDataSchema.parse(response.body.data).token;
});

afterAll(async () => {
  await prisma.users.deleteMany({ where: { email } });
  await disconnectPrisma();
});

it('las rutas admin niegan acceso sin sesión y con token STUDENT', async () => {
  for (const [method, path] of paths) {
    const noSession = await request(app)[method](path);
    expect(noSession.status).toBe(401);
    const asStudent = await request(app)
      [method](path)
      .set(AuthHeaders.authorization, `${AuthHeaders.bearer_prefix}${studentToken}`);
    expect(asStudent.status).toBe(403);
  }
});
