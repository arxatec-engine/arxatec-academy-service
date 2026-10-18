import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app/create_app';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { AuthHeaders } from '@/constants/auth';
import { AdminCourseRoutePrefix, AdminLessonRoutePrefix, AdminRoutePrefix, ApiPrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { course_level, course_topic, lesson_status, lesson_type, user_city, user_role } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';
import { postJson, sessionDataSchema } from './helpers/auth_client';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

const courseRoot = `${ApiPrefix}${AdminRoutePrefix}${AdminCourseRoutePrefix}`;
const lessonRoot = `${ApiPrefix}${AdminRoutePrefix}${AdminLessonRoutePrefix}`;
const suffix = Date.now().toString(36);
const email = `admin-lecciones-${suffix}@example.test`;
const envelope = z.object({ data: z.unknown().optional(), meta: z.object({ code: z.string() }).optional() });
const courseDetail = z.object({ course: z.object({ id: z.string() }) });
const lessonDetail = z.object({ lesson: z.object({ id: z.string(), type: z.string(),
  article_body: z.string().nullable(), article_word_count: z.number().nullable(),
  reading_minutes: z.number().nullable(), status: z.string(), is_free_sample: z.boolean(),
  video: z.object({ provider: z.string(), external_id: z.string().nullable() }).nullable() }) });

let app: Express;
let token = '';
let courseId = '';
const lessonIds: string[] = [];
const auth = () => ({ [AuthHeaders.authorization]: `${AuthHeaders.bearer_prefix}${token}` });
const parseLesson = (body: unknown) => lessonDetail.parse(envelope.parse(body).data);

beforeAll(async () => {
  app = createApp();
  jest.mocked(sendEmail).mockResolvedValue(undefined);
  const registration = await postJson(app, 'register', {
    full_name: 'Admin de lecciones', email, password: 'claveLargaDePrueba',
    is_independent: true, city: user_city.LIMA,
  });
  const session = sessionDataSchema.parse(registration.body.data);
  token = session.token;
  await prisma.users.update({ where: { id: session.user.id },
    data: { role: user_role.ADMIN }, select: { id: true } });
  const response = await request(app).post(courseRoot).set(auth()).send({
    title: `Curso lecciones ${suffix}`, topic: course_topic.FIRST_STEPS,
    level: course_level.INTRODUCTORY,
  });
  courseId = courseDetail.parse(envelope.parse(response.body).data).course.id;
});

afterAll(async () => {
  if (courseId) await prisma.courses.delete({ where: { id: courseId }, select: { id: true } });
  await prisma.users.deleteMany({ where: { email } });
  await disconnectPrisma();
});

it('crea, sanea, reordena y publica lecciones', async () => {
  for (const title of ['Primera', 'Segunda']) {
    const response = await request(app).post(`${courseRoot}/${courseId}/lessons`).set(auth())
      .send({ title, type: lesson_type.ARTICLE });
    expect(response.status).toBe(201);
    lessonIds.push(parseLesson(response.body).lesson.id);
  }
  const article = '<script>alert(1)</script><h2>Bienvenida</h2><p>Texto útil</p>';
  const saved = await request(app).patch(`${lessonRoot}/${lessonIds[0]}`).set(auth()).send({
    description: 'Lección inicial', article_body: article, is_free_sample: true,
    reading_minutes: 500, status: lesson_status.PUBLISHED,
  });
  expect(saved.status).toBe(200);
  const parsed = parseLesson(saved.body).lesson;
  expect(parsed.article_body).not.toContain('alert');
  expect(parsed.article_word_count).toBe(3);
  expect(parsed.reading_minutes).toBe(1);
  expect(parsed.status).toBe(lesson_status.DRAFT);

  const reordered = await request(app).put(`${courseRoot}/${courseId}/lessons/order`).set(auth())
    .send({ lesson_ids: [...lessonIds].reverse() });
  expect(reordered.status).toBe(200);
  const positions = await prisma.lessons.findMany({ where: { course_id: courseId },
    select: { id: true, position: true }, orderBy: { position: 'asc' } });
  expect(positions.map((row) => row.id)).toEqual([...lessonIds].reverse());

  const published = await request(app).post(`${lessonRoot}/${lessonIds[0]}/publish`).set(auth());
  expect(published.status).toBe(200);
  expect(parseLesson(published.body).lesson.status).toBe(lesson_status.PUBLISHED);

  const blocked = await request(app).delete(`${lessonRoot}/${lessonIds[0]}`).set(auth());
  expect(envelope.parse(blocked.body).meta?.code).toBe(ErrorCodes.LESSON_PUBLISHED);
  await request(app).delete(`${lessonRoot}/${lessonIds[0]}/publish`).set(auth());
  const removed = await request(app).delete(`${lessonRoot}/${lessonIds[0]}`).set(auth());
  expect(removed.status).toBe(204);
  const remaining = await prisma.lessons.findMany({ where: { course_id: courseId },
    select: { position: true } });
  expect(remaining.map((row) => row.position)).toEqual([1]);
});

it('limpia el tipo anterior incluso si el editor manda campos rezagados', async () => {
  const response = await request(app).post(`${courseRoot}/${courseId}/lessons`).set(auth())
    .send({ title: 'Cambio de tipo', type: lesson_type.ARTICLE });
  expect(response.status).toBe(201);
  const id = parseLesson(response.body).lesson.id;
  await request(app).patch(`${lessonRoot}/${id}`).set(auth())
    .send({ article_body: '<p>Contenido anterior</p>', description: 'Preparado' });
  const published = await request(app).post(`${lessonRoot}/${id}/publish`).set(auth());
  expect(published.status).toBe(200);
  const blocked = await request(app).patch(`${lessonRoot}/${id}`).set(auth())
    .send({ type: lesson_type.VIDEO, video_external_id: '12345', article_body: '<p>Rezago</p>' });
  expect(envelope.parse(blocked.body).meta?.code).toBe(ErrorCodes.LESSON_TYPE_CHANGE_NOT_CONFIRMED);
  const changed = await request(app).patch(`${lessonRoot}/${id}`).set(auth())
    .send({ type: lesson_type.VIDEO, video_provider: 'VIMEO', video_external_id: '12345',
      article_body: '<p>Rezago</p>', confirm_type_change: true });
  expect(changed.status).toBe(200);
  expect(parseLesson(changed.body).lesson.article_body).toBeNull();
  expect(parseLesson(changed.body).lesson.status).toBe(lesson_status.DRAFT);
  expect(parseLesson(changed.body).lesson.video?.external_id).toBe('12345');
  const saved = await request(app).patch(`${lessonRoot}/${id}`).set(auth())
    .send({ article_body: '<p>Otro rezago</p>' });
  expect(saved.status).toBe(200);
  expect(parseLesson(saved.body).lesson.article_body).toBeNull();
});

it('publica YouTube con duración manual y conserva el proveedor en la API', async () => {
  const probe = await request(app).post(`${ApiPrefix}${AdminRoutePrefix}/videos/probe`).set(auth())
    .send({ provider: 'YOUTUBE', external_id: 'dQw4w9WgXcQ' });
  expect(probe.status).toBe(200);
  expect(z.object({ duration_seconds: z.null() }).parse(envelope.parse(probe.body).data).duration_seconds).toBeNull();
  const response = await request(app).post(`${courseRoot}/${courseId}/lessons`).set(auth())
    .send({ title: 'Video YouTube', type: lesson_type.VIDEO });
  expect(response.status).toBe(201);
  const id = parseLesson(response.body).lesson.id;
  const invalid = await request(app).patch(`${lessonRoot}/${id}`).set(auth())
    .send({ video_provider: 'YOUTUBE', video_external_id: 'not-an-id' });
  expect(invalid.status).toBe(422);
  const saved = await request(app).patch(`${lessonRoot}/${id}`).set(auth()).send({
    description: 'Video público de prueba', video_provider: 'YOUTUBE',
    video_external_id: 'dQw4w9WgXcQ', duration_seconds: 213,
  });
  expect(saved.status).toBe(200);
  expect(parseLesson(saved.body).lesson.video).toEqual({ provider: 'YOUTUBE', external_id: 'dQw4w9WgXcQ' });
  const published = await request(app).post(`${lessonRoot}/${id}/publish`).set(auth());
  expect(published.status).toBe(200);
  expect(parseLesson(published.body).lesson.status).toBe(lesson_status.PUBLISHED);
  const changed = await request(app).patch(`${lessonRoot}/${id}`).set(auth())
    .send({ video_external_id: 'M7lc1UVf-VE' });
  expect(changed.status).toBe(200);
  expect(parseLesson(changed.body).lesson.status).toBe(lesson_status.DRAFT);
  const incomplete = await request(app).post(`${lessonRoot}/${id}/publish`).set(auth());
  expect(envelope.parse(incomplete.body).meta?.code).toBe(ErrorCodes.LESSON_INCOMPLETE);
});

it('elige YouTube para un ID nuevo sin proveedor explícito', async () => {
  const created = await request(app).post(`${courseRoot}/${courseId}/lessons`).set(auth())
    .send({ title: 'YouTube por defecto', type: lesson_type.VIDEO });
  const id = parseLesson(created.body).lesson.id;
  const saved = await request(app).patch(`${lessonRoot}/${id}`).set(auth()).send({
    description: 'Video con proveedor implícito', video_external_id: 'dQw4w9WgXcQ', duration_seconds: 213,
  });
  expect(saved.status).toBe(200);
  expect(parseLesson(saved.body).lesson.video?.provider).toBe('YOUTUBE');
});
