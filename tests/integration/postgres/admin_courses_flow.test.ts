import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app/create_app';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { AuthHeaders } from '@/constants/auth';
import { AdminCourseRoutePrefix, AdminRoutePrefix, ApiPrefix, CoursesRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { course_level, course_status, course_topic, lesson_status, lesson_type, user_city, user_role } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';
import { postJson, sessionDataSchema } from './helpers/auth_client';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

const root = `${ApiPrefix}${AdminRoutePrefix}${AdminCourseRoutePrefix}`;
const suffix = Date.now().toString(36);
const email = `admin-cursos-${suffix}@example.test`;
const title = `Curso de prueba ${suffix}`;
const envelope = z.object({ data: z.unknown().optional(), meta: z.object({ code: z.string() }).optional() });
const detail = z.object({ course: z.object({ id: z.string(), slug: z.string(), updated_at: z.string(),
  status: z.string(), published_at: z.string().nullable() }) });

let app: Express;
let token = '';
let userId = '';
const courseIds: string[] = [];

const authorized = () => ({ [AuthHeaders.authorization]: `${AuthHeaders.bearer_prefix}${token}` });
const parseDetail = (body: unknown) => detail.parse(envelope.parse(body).data);

beforeAll(async () => {
  app = createApp();
  jest.mocked(sendEmail).mockResolvedValue(undefined);
  const registration = await postJson(app, 'register', {
    full_name: 'Admin de prueba', email, password: 'claveLargaDePrueba',
    is_independent: true, city: user_city.LIMA,
  });
  const session = sessionDataSchema.parse(registration.body.data);
  token = session.token;
  userId = session.user.id;
  await prisma.users.update({ where: { id: userId }, data: { role: user_role.ADMIN }, select: { id: true } });
});

afterAll(async () => {
  await prisma.courses.deleteMany({ where: { id: { in: courseIds } } });
  await prisma.users.deleteMany({ where: { email } });
  await disconnectPrisma();
});

it('protege las diez rutas con sesión y rol ADMIN', async () => {
  const calls = [
    ['get', root], ['post', root], ['get', `${root}/id`], ['patch', `${root}/id`],
    ['post', `${root}/id/publish`], ['post', `${root}/id/unpublish`],
    ['post', `${root}/id/duplicate`], ['post', `${root}/id/archive`],
    ['put', `${root}/order`], ['put', `${root}/id/cover`],
  ] as const;
  for (const [method, path] of calls) {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
  }
});

it('crea, autoguarda, publica, despublica, duplica y archiva', async () => {
  const createdResponse = await request(app).post(root).set(authorized()).send({
    title, topic: course_topic.FIRST_STEPS, level: course_level.INTRODUCTORY,
  });
  expect(createdResponse.status).toBe(201);
  const created = parseDetail(createdResponse.body);
  courseIds.push(created.course.id);
  expect(created.course.status).toBe(course_status.DRAFT);

  const stale = created.course.updated_at;
  const patch = await request(app).patch(`${root}/${created.course.id}`).set(authorized()).send({
    expected_updated_at: stale,
    short_description: 'Una descripción corta', long_description: 'Una descripción larga',
  });
  expect(patch.status).toBe(200);
  const patched = parseDetail(patch.body);
  expect(patched.course.updated_at).not.toBe(stale);

  const stalePatch = await request(app).patch(`${root}/${created.course.id}`).set(authorized()).send({
    expected_updated_at: stale, title: 'No debe guardarse',
  });
  expect(stalePatch.status).toBe(409);
  expect(envelope.parse(stalePatch.body).meta?.code).toBe(ErrorCodes.STALE_UPDATE);
  expect((await prisma.courses.findUniqueOrThrow({ where: { id: created.course.id },
    select: { title: true } })).title).toBe(title);

  const noLessons = await request(app).post(`${root}/${created.course.id}/publish`).set(authorized());
  expect(noLessons.status).toBe(409);
  expect(envelope.parse(noLessons.body).meta?.code).toBe(ErrorCodes.COURSE_HAS_NO_LESSONS);

  const sourceLesson = await prisma.lessons.create({
    data: { course_id: created.course.id, slug: 'muestra', title: 'Muestra', description: 'Muestra',
      type: lesson_type.ARTICLE, article_body: 'Texto', article_word_count: 1,
      reading_minutes: 1, position: 1, status: lesson_status.PUBLISHED },
    select: { id: true },
  });
  await prisma.lesson_resources.create({ data: {
    lesson_id: sourceLesson.id, title: 'Guía', file_url: 'https://example.test/guia.pdf',
    file_key: 'test/guia.pdf', mime_type: 'application/pdf', size_bytes: 12, position: 1,
  }, select: { id: true } });
  const published = await request(app).post(`${root}/${created.course.id}/publish`).set(authorized());
  expect(published.status).toBe(200);
  const publishedAt = parseDetail(published.body).course.published_at;
  expect(publishedAt).not.toBeNull();
  const again = await request(app).post(`${root}/${created.course.id}/publish`).set(authorized());
  expect(parseDetail(again.body).course.published_at).toBe(publishedAt);

  const publicDetail = await request(app).get(`${ApiPrefix}${CoursesRoutePrefix}/${created.course.slug}`);
  expect(publicDetail.status).toBe(200);

  await prisma.enrollments.create({ data: { user_id: userId, course_id: created.course.id,
    last_lesson_id: sourceLesson.id }, select: { id: true } });
  await prisma.lesson_progress.create({ data: { user_id: userId, lesson_id: sourceLesson.id,
    last_position_seconds: 10 }, select: { id: true } });

  const duplicate = await request(app).post(`${root}/${created.course.id}/duplicate`).set(authorized());
  expect(duplicate.status).toBe(201);
  const copied = parseDetail(duplicate.body);
  courseIds.push(copied.course.id);
  const copyLessons = await prisma.lessons.findMany({
    where: { course_id: copied.course.id }, select: { status: true, article_body: true,
      resources: { select: { file_key: true } }, lesson_progress: { select: { id: true } } },
  });
  expect(copyLessons).toEqual([{ status: lesson_status.DRAFT, article_body: 'Texto',
    resources: [{ file_key: 'test/guia.pdf' }], lesson_progress: [] }]);
  expect(await prisma.enrollments.count({ where: { course_id: copied.course.id } })).toBe(0);

  const unpublished = await request(app).post(`${root}/${created.course.id}/unpublish`).set(authorized());
  expect(parseDetail(unpublished.body).course.published_at).toBe(publishedAt);
  const locked = await request(app).patch(`${root}/${created.course.id}`).set(authorized()).send({
    expected_updated_at: parseDetail(unpublished.body).course.updated_at,
    slug: `nuevo-${suffix}`,
  });
  expect(envelope.parse(locked.body).meta?.code).toBe(ErrorCodes.SLUG_LOCKED);

  const archived = await request(app).post(`${root}/${created.course.id}/archive`).set(authorized());
  expect(parseDetail(archived.body).course.status).toBe(course_status.ARCHIVED);
  expect(await prisma.enrollments.count({ where: { course_id: created.course.id } })).toBe(1);
  expect(await prisma.lesson_progress.count({ where: { lesson_id: sourceLesson.id } })).toBe(1);
  const absent = await request(app).get(`${ApiPrefix}${CoursesRoutePrefix}/${created.course.slug}`);
  expect(absent.status).toBe(404);
});

it('desambigua slug generado, rechaza el slug elegido y no permite publicar con PATCH', async () => {
  const payload = { title: `Colisión ${suffix}`, topic: course_topic.FIRST_STEPS,
    level: course_level.INTRODUCTORY };
  const first = parseDetail((await request(app).post(root).set(authorized()).send(payload)).body);
  const second = parseDetail((await request(app).post(root).set(authorized()).send(payload)).body);
  courseIds.push(first.course.id, second.course.id);
  expect(second.course.slug).toBe(`${first.course.slug}-2`);
  const originalTitle = (await prisma.courses.findUniqueOrThrow({ where: { id: first.course.id },
    select: { title: true } })).title;
  expect(originalTitle).toBe(payload.title);

  const conflict = await request(app).patch(`${root}/${second.course.id}`).set(authorized()).send({
    expected_updated_at: second.course.updated_at, slug: first.course.slug,
  });
  expect(envelope.parse(conflict.body).meta?.code).toBe(ErrorCodes.SLUG_TAKEN);
  const ignored = await request(app).patch(`${root}/${second.course.id}`).set(authorized()).send({
    expected_updated_at: second.course.updated_at, status: course_status.PUBLISHED,
  });
  expect(ignored.status).toBe(200);
  expect(parseDetail(ignored.body).course.status).toBe(course_status.DRAFT);

  const tooLong = await request(app).patch(`${root}/${second.course.id}`).set(authorized()).send({
    expected_updated_at: parseDetail(ignored.body).course.updated_at,
    short_description: 'x'.repeat(141),
  });
  expect(tooLong.status).toBe(422);
});
