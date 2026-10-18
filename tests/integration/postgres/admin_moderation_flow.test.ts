import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app/create_app';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { AuthHeaders } from '@/constants/auth';
import { AdminCommentsRoutePrefix, AdminRoutePrefix, ApiPrefix } from '@/constants/endpoints';
import { comment_status, course_level, course_status, course_topic, lesson_status, lesson_type, user_city, user_role } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';
import { postJson, sessionDataSchema } from './helpers/auth_client';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));
const root = `${ApiPrefix}${AdminRoutePrefix}${AdminCommentsRoutePrefix}`;
const suffix = Date.now().toString(36);
const adminEmail = `moderador-${suffix}@example.test`;
const studentEmail = `comentador-${suffix}@example.test`;
const envelope = z.object({ data: z.unknown().optional() });
const counts = z.object({ counts: z.object({ pending: z.number(), reported: z.number() }) });
const list = z.object({ comments: z.array(z.object({ id: z.string(), is_answered: z.boolean().nullable() })) });
let app: Express;
let adminToken = '';
let adminId = '';
let studentId = '';
let courseId = '';
let commentId = '';
const auth = () => ({ [AuthHeaders.authorization]: `${AuthHeaders.bearer_prefix}${adminToken}` });

beforeAll(async () => {
  app = createApp();
  jest.mocked(sendEmail).mockResolvedValue(undefined);
  const admin = sessionDataSchema.parse((await postJson(app, 'register', {
    full_name: 'Moderador', email: adminEmail, password: 'claveLargaDePrueba',
    is_independent: true, city: user_city.LIMA,
  })).body.data);
  adminToken = admin.token;
  adminId = admin.user.id;
  const student = sessionDataSchema.parse((await postJson(app, 'register', {
    full_name: 'Comentarista', email: studentEmail, password: 'claveLargaDePrueba',
    is_independent: true, city: user_city.LIMA,
  })).body.data);
  studentId = student.user.id;
  await prisma.users.update({ where: { id: adminId }, data: { role: user_role.ADMIN }, select: { id: true } });
  const course = await prisma.courses.create({ data: {
    slug: `moderacion-${suffix}`, title: 'Moderación de prueba', short_description: 'Prueba',
    long_description: 'Prueba', topic: course_topic.FIRST_STEPS, level: course_level.INTRODUCTORY,
    status: course_status.PUBLISHED, catalog_order: 9999,
  }, select: { id: true } });
  courseId = course.id;
  const lesson = await prisma.lessons.create({ data: {
    course_id: courseId, slug: 'prueba', title: 'Prueba', description: 'Prueba',
    type: lesson_type.ARTICLE, position: 1, status: lesson_status.PUBLISHED,
  }, select: { id: true } });
  const comment = await prisma.comments.create({ data: {
    lesson_id: lesson.id, user_id: studentId, body: 'Pregunta de prueba',
  }, select: { id: true } });
  commentId = comment.id;
});

afterAll(async () => {
  if (courseId) await prisma.courses.delete({ where: { id: courseId }, select: { id: true } });
  await prisma.users.deleteMany({ where: { email: { in: [adminEmail, studentEmail] } } });
  await disconnectPrisma();
});

it('responde, oculta, muestra y borra con contadores coherentes', async () => {
  const initial = await request(app).get(`${root}/counts`).set(auth());
  expect(initial.status).toBe(200);
  expect(counts.parse(envelope.parse(initial.body).data).counts.pending).toBeGreaterThanOrEqual(1);

  const reply = await request(app).post(`${root}/${commentId}/replies`).set(auth()).send({ body: 'Respuesta' });
  expect(reply.status).toBe(201);
  const recent = await request(app).get(root).set(auth());
  const row = list.parse(envelope.parse(recent.body).data).comments.find((item) => item.id === commentId);
  expect(row?.is_answered).toBe(true);

  const hidden = await request(app).patch(`${root}/${commentId}/status`).set(auth()).send({ status: 'HIDDEN' });
  expect(hidden.status).toBe(200);
  const hiddenAt = await prisma.comments.findUniqueOrThrow({ where: { id: commentId },
    select: { hidden_at: true } });
  await request(app).patch(`${root}/${commentId}/status`).set(auth()).send({ status: 'HIDDEN' });
  const again = await prisma.comments.findUniqueOrThrow({ where: { id: commentId },
    select: { hidden_at: true } });
  expect(again.hidden_at).toEqual(hiddenAt.hidden_at);

  const visible = await request(app).patch(`${root}/${commentId}/status`).set(auth()).send({ status: 'VISIBLE' });
  expect(visible.status).toBe(200);
  const deleted = await request(app).delete(`${root}/${commentId}`).set(auth());
  expect(deleted.status).toBe(200);
  await request(app).delete(`${root}/${commentId}`).set(auth());
  const stored = await prisma.comments.findUniqueOrThrow({ where: { id: commentId },
    select: { status: true, body: true, deleted_at: true } });
  expect(stored.status).toBe(comment_status.DELETED);
  expect(stored.body).toBe('Pregunta de prueba');
  expect(stored.deleted_at).not.toBeNull();
});
