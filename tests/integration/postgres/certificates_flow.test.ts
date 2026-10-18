import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { z } from 'zod';
import { createApp } from '@/app/create_app';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import {
  course_level,
  course_status,
  course_topic,
  lesson_status,
  lesson_type,
  user_role,
} from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

const app = createApp();
const createdUserIds: string[] = [];
const createdCourseIds: string[] = [];
const recipient_name = 'María José Núñez Álvarez';
const course_title = 'Automatización jurídica y legal tech';
let adminBearer = '';
let adminUserId = '';

const publicCertificateSchema = z
  .object({
    id: z.uuid(),
    recipient_name: z.string(),
    course_title: z.string(),
    completed_at: z.string(),
    issued_at: z.string(),
    verification_url: z.url(),
    qr_code_data_url: z.string(),
  })
  .strict();

beforeAll(async () => {
  jest.mocked(sendEmail).mockResolvedValue(undefined);
  const password = 'instructor-test-password-123';
  const email = `examen-admin-${randomUUID()}@academy.test`;
  const signup = await request(app).post('/api/v1/auth/register').send({
    full_name: 'Instructor de exámenes',
    email,
    password,
  });
  expect(signup.status).toBe(201);
  adminUserId = z.object({ user: z.object({ id: z.string() }) }).parse(signup.body.data).user.id;
  await prisma.users.update({ where: { id: adminUserId }, data: { role: user_role.ADMIN } });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  adminBearer = `Bearer ${z.object({ token: z.string() }).parse(login.body.data).token}`;
});
beforeEach(() => jest.mocked(sendEmail).mockResolvedValue(undefined));
afterEach(async () => {
  await prisma.users.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
  await prisma.courses.deleteMany({ where: { id: { in: createdCourseIds.splice(0) } } });
});
afterAll(async () => {
  if (adminUserId) await prisma.users.deleteMany({ where: { id: adminUserId } });
  await disconnectPrisma();
});

const fixture = async () => {
  const signup = await request(app)
    .post('/api/v1/auth/register')
    .send({
      full_name: recipient_name,
      email: `certificado-${randomUUID()}@academy.test`,
      password: 'certificado-test-password-123',
    });
  expect(signup.status).toBe(201);
  const session = z
    .object({ token: z.string(), user: z.object({ id: z.string() }) })
    .parse(signup.body.data);
  createdUserIds.push(session.user.id);
  const course = await prisma.courses.create({
    data: {
      slug: `certificado-${randomUUID()}`,
      title: course_title,
      short_description: 'Curso de prueba para certificados',
      long_description: 'Contenido del curso de prueba para certificados.',
      topic: course_topic.FIRST_STEPS,
      level: course_level.INTRODUCTORY,
      status: course_status.PUBLISHED,
      catalog_order: 999,
      published_at: new Date(),
      lessons: {
        create: [1, 2].map((position) => ({
          slug: `leccion-${position}`,
          title: `Lección ${position}`,
          description: 'Lección de prueba',
          type: lesson_type.ARTICLE,
          position,
          status: lesson_status.PUBLISHED,
          article_body: '<p>Contenido de prueba.</p>',
          article_word_count: 3,
          reading_minutes: 1,
        })),
      },
    },
    include: { lessons: { orderBy: { position: 'asc' } } },
  });
  createdCourseIds.push(course.id);
  const questions = Array.from({ length: 15 }, (_, index) => ({
    text: `Pregunta jurídica ${index + 1}`,
    options: ['Respuesta A', 'Respuesta B', 'Respuesta C', 'Respuesta D'],
    correct_option: 0,
  }));
  const examInput = { expected_version: 0, enabled: true, passing_score: 12, questions };
  const examPath = `/api/v1/admin/courses/${course.id}/exam`;
  const invalid = await request(app)
    .put(examPath)
    .set('Authorization', adminBearer)
    .send({ ...examInput, questions: questions.slice(1) });
  expect(invalid.status).toBe(422);
  const saved = await request(app).put(examPath).set('Authorization', adminBearer).send(examInput);
  expect(saved.status).toBe(200);
  expect(saved.body.data.exam).toMatchObject({ version: 1, passing_score: 12, questions });
  return { course, session, bearer: `Bearer ${session.token}`, adminBearer, examInput, examPath };
};

describe('certificados por examen aprobado y verificación pública', () => {
  it.each(['complete', 'progress'] as const)(
    'completar por %s solo habilita el examen; aprobarlo emite una vez y sirve PDF público',
    async (endpoint) => {
      const { course, session, bearer, adminBearer, examInput, examPath } = await fixture();
      const first = course.lessons[0];
      const last = course.lessons[1];
      if (!first || !last) throw new Error('Missing fixture lessons');
      const complete = (id: string) =>
        request(app).post(`/api/v1/lessons/${id}/complete`).set('Authorization', bearer);
      const studentExamPath = `/api/v1/courses/${course.slug}/exam`;
      const submit = (score: number) =>
        request(app)
          .post(`${studentExamPath}/attempts`)
          .set('Authorization', bearer)
          .send({
            version: 1,
            answers: Array.from({ length: 15 }, (_, index) => (index < score ? 0 : 1)),
          });
      expect((await request(app).get(studentExamPath)).status).toBe(401);
      expect((await submit(15)).status).toBe(403);
      expect(
        (await request(app).get(studentExamPath).set('Authorization', bearer)).body.data.exam,
      ).toMatchObject({ status: 'locked', questions: [] });

      expect((await complete(first.id)).status).toBe(200);
      expect(await prisma.certificates.count({ where: { user_id: session.user.id } })).toBe(0);
      if (endpoint === 'complete') {
        const results = await Promise.all([complete(last.id), complete(last.id)]);
        expect(results.map((result) => result.status)).toEqual([200, 200]);
      } else {
        const result = await request(app)
          .put(`/api/v1/lessons/${last.id}/progress`)
          .set('Authorization', bearer)
          .send({ last_position_seconds: 0, completed: true });
        expect(result.status).toBe(200);
      }

      expect(await prisma.certificates.count({ where: { user_id: session.user.id } })).toBe(0);
      const ready = await request(app).get(studentExamPath).set('Authorization', bearer);
      expect(ready.body.data.exam).toMatchObject({ status: 'ready', passing_score: 12 });
      expect(ready.body.data.exam.questions).toHaveLength(15);
      expect(JSON.stringify(ready.body)).not.toContain('correct_option');
      const failed = await submit(11);
      expect(failed.status).toBe(200);
      expect(failed.body.data.result).toMatchObject({
        score: 11,
        passed: false,
        certificate_id: null,
      });
      expect(await prisma.certificates.count({ where: { user_id: session.user.id } })).toBe(0);
      const passing = await Promise.all([submit(12), submit(12)]);
      expect(passing.map((response) => response.status)).toEqual([200, 200]);
      expect(passing[0]?.body.data.result).toMatchObject({ score: 12, passed: true });
      expect(passing[0]?.body.data.result.certificate_id).toBe(
        passing[1]?.body.data.result.certificate_id,
      );
      const replay = await submit(12);
      expect(replay.status).toBe(200);
      expect(replay.body.data.result.certificate_id).toBe(
        passing[0]?.body.data.result.certificate_id,
      );
      expect(await prisma.exam_attempts.count({ where: { user_id: session.user.id } })).toBe(2);

      const certificates = await prisma.certificates.findMany({
        where: { user_id: session.user.id },
      });
      expect(certificates).toHaveLength(1);
      const issued = certificates[0];
      if (!issued) throw new Error('Missing issued certificate');
      expect(issued.exam_attempt_id).not.toBeNull();
      const path = `/api/v1/certificates/${issued.id}`;
      const myCourses = await request(app).get('/api/v1/me/courses').set('Authorization', bearer);
      expect(myCourses.body.data.completed[0].certificate_id).toBe(issued.id);
      const publicResult = await request(app).get(path);
      expect(publicResult.status).toBe(200);
      const certificate = publicCertificateSchema.parse(publicResult.body.data.certificate);
      expect(certificate).toMatchObject({ id: issued.id, recipient_name, course_title });
      expect(certificate.verification_url).toMatch(new RegExp(`/certificados/${issued.id}$`));
      expect(certificate.qr_code_data_url).toMatch(/^data:image\/png;base64,/);
      expect(JSON.stringify(publicResult.body)).not.toContain(session.user.id);
      expect(JSON.stringify(publicResult.body)).not.toContain('@academy.test');

      const pdf = await request(app).get(`${path}/pdf`);
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toMatch(/^application\/pdf/);
      expect(pdf.headers['content-disposition']).toContain(`certificado-${issued.id}.pdf`);
      expect(Buffer.isBuffer(pdf.body)).toBe(true);
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      const examUpdate = await request(app)
        .put(examPath)
        .set('Authorization', adminBearer)
        .send({ ...examInput, expected_version: 1, enabled: false, passing_score: 15 });
      expect(examUpdate.status).toBe(200);
      expect(
        (await request(app).get(studentExamPath).set('Authorization', bearer)).body.data.exam,
      ).toMatchObject({ status: 'passed', certificate_id: issued.id });

      expect(
        (
          await request(app)
            .delete(`/api/v1/lessons/${last.id}/complete`)
            .set('Authorization', bearer)
        ).status,
      ).toBe(200);
      await prisma.users.update({
        where: { id: session.user.id },
        data: { full_name: 'Nombre actualizado' },
      });
      await prisma.courses.update({
        where: { id: course.id },
        data: { title: 'Título actualizado' },
      });
      expect((await complete(last.id)).status).toBe(200);
      expect(await prisma.certificates.findMany({ where: { user_id: session.user.id } })).toEqual([
        issued,
      ]);
      await prisma.courses.update({
        where: { id: course.id },
        data: { status: course_status.ARCHIVED },
      });
      const historical = await request(app).get(path);
      expect(historical.status).toBe(200);
      expect(publicCertificateSchema.parse(historical.body.data.certificate)).toEqual(certificate);

      await prisma.users.delete({ where: { id: session.user.id } });
      expect(await prisma.exam_attempts.count({ where: { user_id: session.user.id } })).toBe(0);
      expect((await request(app).get(path)).status).toBe(404);
      expect((await request(app).get(`${path}/pdf`)).status).toBe(404);
    },
  );

  it('rechaza exámenes desactivados, versiones obsoletas y lecciones desmarcadas', async () => {
    const { course, bearer, adminBearer, examInput, examPath, session } = await fixture();
    for (const lesson of course.lessons) {
      expect(
        (
          await request(app)
            .post(`/api/v1/lessons/${lesson.id}/complete`)
            .set('Authorization', bearer)
        ).status,
      ).toBe(200);
    }
    const path = `/api/v1/courses/${course.slug}/exam/attempts`;
    const submit = (version: number) =>
      request(app)
        .post(path)
        .set('Authorization', bearer)
        .send({ version, answers: Array.from({ length: 15 }, () => 0) });
    const staleAdmin = await request(app)
      .put(examPath)
      .set('Authorization', adminBearer)
      .send(examInput);
    expect(staleAdmin.status).toBe(409);
    expect(
      (
        await request(app)
          .put(examPath)
          .set('Authorization', adminBearer)
          .send({ ...examInput, expected_version: 1 })
      ).status,
    ).toBe(200);
    expect((await submit(1)).body.meta.code).toBe('EXAM_CHANGED');
    expect(
      (
        await request(app)
          .put(examPath)
          .set('Authorization', adminBearer)
          .send({ ...examInput, expected_version: 2, enabled: false })
      ).status,
    ).toBe(200);
    expect((await submit(3)).body.meta.code).toBe('EXAM_UNAVAILABLE');
    expect(
      (
        await request(app)
          .put(examPath)
          .set('Authorization', adminBearer)
          .send({ ...examInput, expected_version: 3 })
      ).status,
    ).toBe(200);
    const first = course.lessons[0];
    if (!first) throw new Error('Missing lesson');
    await request(app).delete(`/api/v1/lessons/${first.id}/complete`).set('Authorization', bearer);
    const locked = await submit(4);
    expect(locked.status).toBe(403);
    expect(locked.body.meta.code).toBe('EXAM_LOCKED');
    expect(await prisma.exam_attempts.count({ where: { user_id: session.user.id } })).toBe(0);
    expect(await prisma.certificates.count({ where: { user_id: session.user.id } })).toBe(0);
  });

  it('no acepta ids inválidos y no inventa certificados para ids desconocidos', async () => {
    expect(
      (await request(app).get(`/api/v1/certificates/${randomUUID()}/pdf?language=fr`)).status,
    ).toBe(422);
    expect((await request(app).get('/api/v1/certificates/no-existe')).status).toBe(422);
    expect((await request(app).get(`/api/v1/certificates/${randomUUID()}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/certificates/${randomUUID()}/pdf`)).status).toBe(404);
  });
});
