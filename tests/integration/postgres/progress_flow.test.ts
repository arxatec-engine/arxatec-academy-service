import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app/create_app';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { AuthHeaders } from '@/constants/auth';
import {
  ApiPrefix,
  AuthEndpoints,
  AuthRoutePrefix,
  CoursesRoutePrefix,
  LessonsRoutePrefix,
  MeRoutePrefix,
  ProgressEndpoints,
} from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { course_status, lesson_status, lesson_type, user_city } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';
import { saveLessonProgress } from '@/modules/progress/shared/data/progress.repository';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

const sendEmailMock = jest.mocked(sendEmail);

const EMAIL_DOMAIN = '@progreso.arxatec.test';
const STUDENT_EMAIL = `ana${EMAIL_DOMAIN}`;
const NEWCOMER_EMAIL = `sin-nada${EMAIL_DOMAIN}`;
const PASSWORD = 'claveDeProgresoLarga';
const COURSE_SLUG = 'fundamentos-de-legal-tech';
const EXTRA_LESSON_SLUG = 'leccion-nueva-de-la-fase-11';

const envelopeSchema = z.object({
  status: z.number(),
  message: z.string(),
  description: z.string(),
  timestamp: z.string(),
  path: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ code: z.string().optional() }).optional(),
});

const enrollmentDataSchema = z.object({
  enrollment: z.object({
    course: z.object({ slug: z.string(), title: z.string() }),
    started_at: z.string(),
    completed_at: z.string().nullable(),
    completed_lessons: z.number(),
    lesson_count: z.number(),
    next_lesson: z.object({ slug: z.string(), title: z.string() }).nullable(),
  }),
});

const myCoursesSchema = z.object({
  in_progress: z.array(
    z.object({
      course: z.object({ slug: z.string(), title: z.string() }),
      completed_lessons: z.number(),
      lesson_count: z.number(),
      next_lesson: z.object({ slug: z.string(), title: z.string() }).nullable(),
    }),
  ),
  completed: z.array(
    z.object({
      course: z.object({ slug: z.string(), title: z.string() }),
      lesson_count: z.number(),
      completed_at: z.string(),
    }),
  ),
});

const progressDataSchema = z.object({
  progress: z.object({
    lesson_id: z.string(),
    last_position_seconds: z.number(),
    completed_at: z.string().nullable(),
    updated_at: z.string(),
  }),
});

interface FlowState {
  student_id: string;
  student_token: string;
  newcomer_token: string;
  course_id: string;
  lesson_ids: string[];
}

const state: FlowState = {
  student_id: '',
  student_token: '',
  newcomer_token: '',
  course_id: '',
  lesson_ids: [],
};

let app: Express;

const bearer = (token: string): string => `${AuthHeaders.bearer_prefix}${token}`;

const registerStudent = async (email: string): Promise<{ id: string; token: string }> => {
  const response = await request(app)
    .post(`${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.register}`)
    .send({
      full_name: 'Ana Torres Vega',
      email,
      password: PASSWORD,
      is_independent: true,
      city: user_city.LIMA,
    });

  expect(response.status).toBe(HttpStatusCodes.CREATED.code);

  const session = z
    .object({ token: z.string(), user: z.object({ id: z.string() }) })
    .parse(envelopeSchema.parse(response.body).data);

  return { id: session.user.id, token: session.token };
};

const enroll = async (token: string) =>
  request(app)
    .post(`${ApiPrefix}${CoursesRoutePrefix}/${COURSE_SLUG}/enroll`)
    .set(AuthHeaders.authorization, bearer(token));

const completeLessonRequest = (token: string, lesson_id: string) =>
  request(app)
    .post(`${ApiPrefix}${LessonsRoutePrefix}/${lesson_id}/complete`)
    .set(AuthHeaders.authorization, bearer(token));

const uncompleteLessonRequest = (token: string, lesson_id: string) =>
  request(app)
    .delete(`${ApiPrefix}${LessonsRoutePrefix}/${lesson_id}/complete`)
    .set(AuthHeaders.authorization, bearer(token));

const myCourses = (token: string) =>
  request(app)
    .get(`${ApiPrefix}${MeRoutePrefix}${ProgressEndpoints.my_courses}`)
    .set(AuthHeaders.authorization, bearer(token));

const removeTestUsers = async (): Promise<void> => {
  await prisma.users.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
};

const removeExtraLesson = async (): Promise<void> => {
  await prisma.lessons.deleteMany({ where: { slug: EXTRA_LESSON_SLUG } });
};

const storedEnrollment = async () =>
  prisma.enrollments.findUnique({
    where: { user_id_course_id: { user_id: state.student_id, course_id: state.course_id } },
    select: { started_at: true, completed_at: true, last_lesson_id: true },
  });

beforeAll(async () => {
  app = createApp();
  sendEmailMock.mockResolvedValue(undefined);
  await removeTestUsers();
  await removeExtraLesson();

  const course = await prisma.courses.findFirstOrThrow({
    where: { slug: COURSE_SLUG },
    select: { id: true },
  });
  const lessons = await prisma.lessons.findMany({
    where: { course_id: course.id, status: lesson_status.PUBLISHED },
    select: { id: true },
    orderBy: { position: 'asc' },
  });

  state.course_id = course.id;
  state.lesson_ids = lessons.map((lesson) => lesson.id);
});

afterAll(async () => {
  await removeTestUsers();
  await removeExtraLesson();
  await prisma.courses.update({
    where: { id: state.course_id },
    data: { status: course_status.PUBLISHED },
  });
  await disconnectPrisma();
});

describe('progreso contra PostgreSQL real', () => {
  it('1. una cuenta nueva ve "Mis cursos" vacío: 200 y dos listas vacías (E3)', async () => {
    const newcomer = await registerStudent(NEWCOMER_EMAIL);

    state.newcomer_token = newcomer.token;

    const response = await myCourses(newcomer.token);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(myCoursesSchema.parse(envelopeSchema.parse(response.body).data)).toEqual({
      in_progress: [],
      completed: [],
    });
  });

  it('2. inscribirse dos veces deja UNA fila y devuelve la misma inscripción', async () => {
    const student = await registerStudent(STUDENT_EMAIL);

    state.student_id = student.id;
    state.student_token = student.token;

    const first = await enroll(student.token);
    const second = await enroll(student.token);

    expect(first.status).toBe(HttpStatusCodes.OK.code);
    expect(second.status).toBe(HttpStatusCodes.OK.code);

    const first_enrollment = enrollmentDataSchema.parse(
      envelopeSchema.parse(first.body).data,
    ).enrollment;
    const second_enrollment = enrollmentDataSchema.parse(
      envelopeSchema.parse(second.body).data,
    ).enrollment;

    expect(second_enrollment.started_at).toBe(first_enrollment.started_at);
    expect(first_enrollment.lesson_count).toBe(state.lesson_ids.length);
    expect(first_enrollment.completed_lessons).toBe(0);
    expect(first_enrollment.next_lesson?.slug).toBe('que-es-legal-tech-y-que-no');

    await expect(
      prisma.enrollments.count({
        where: { user_id: state.student_id, course_id: state.course_id },
      }),
    ).resolves.toBe(1);
  });

  it('3. PUT guarda el minuto y un minuto menor NO lo mueve hacia atrás', async () => {
    const lesson_id = state.lesson_ids[0] ?? '';

    const saved = await request(app)
      .put(`${ApiPrefix}${LessonsRoutePrefix}/${lesson_id}/progress`)
      .set(AuthHeaders.authorization, bearer(state.student_token))
      .send({ last_position_seconds: 252 });

    expect(saved.status).toBe(HttpStatusCodes.OK.code);
    expect(
      progressDataSchema.parse(envelopeSchema.parse(saved.body).data).progress
        .last_position_seconds,
    ).toBe(252);

    const late = await saveLessonProgress({
      user_id: state.student_id,
      lesson_id,
      last_position_seconds: 30,
    });

    expect(late.last_position_seconds).toBe(252);

    const forward = await saveLessonProgress({
      user_id: state.student_id,
      lesson_id,
      last_position_seconds: 300,
    });

    expect(forward.last_position_seconds).toBe(300);
  });

  it('4. dos guardados simultáneos de la misma lección: una fila y ningún 500', async () => {
    const lesson_id = state.lesson_ids[1] ?? '';

    const [first, second] = await Promise.all([
      saveLessonProgress({ user_id: state.student_id, lesson_id, last_position_seconds: 400 }),
      saveLessonProgress({ user_id: state.student_id, lesson_id, last_position_seconds: 401 }),
    ]);

    expect(first.lesson_id).toBe(lesson_id);
    expect(second.lesson_id).toBe(lesson_id);

    await expect(
      prisma.lesson_progress.count({ where: { user_id: state.student_id, lesson_id } }),
    ).resolves.toBe(1);

    const stored = await prisma.lesson_progress.findUniqueOrThrow({
      where: { user_id_lesson_id: { user_id: state.student_id, lesson_id } },
      select: { last_position_seconds: true },
    });

    expect(stored.last_position_seconds).toBe(401);
  });

  it('5. veinte guardados a la vez tampoco rompen el índice único', async () => {
    const lesson_id = state.lesson_ids[2] ?? '';

    await Promise.all(
      Array.from({ length: 20 }, (_unused, index) =>
        saveLessonProgress({
          user_id: state.student_id,
          lesson_id,
          last_position_seconds: index + 1,
        }),
      ),
    );

    await expect(
      prisma.lesson_progress.count({ where: { user_id: state.student_id, lesson_id } }),
    ).resolves.toBe(1);

    const stored = await prisma.lesson_progress.findUniqueOrThrow({
      where: { user_id_lesson_id: { user_id: state.student_id, lesson_id } },
      select: { last_position_seconds: true },
    });

    expect(stored.last_position_seconds).toBe(20);
  });

  it('6. completar la última lección que faltaba sella completed_at del curso', async () => {
    for (const lesson_id of state.lesson_ids.slice(0, -1)) {
      const response = await completeLessonRequest(state.student_token, lesson_id);

      expect(response.status).toBe(HttpStatusCodes.OK.code);
      await expect(storedEnrollment()).resolves.toMatchObject({ completed_at: null });
    }

    const last = await completeLessonRequest(state.student_token, state.lesson_ids.at(-1) ?? '');

    expect(last.status).toBe(HttpStatusCodes.OK.code);

    const enrollment = await storedEnrollment();

    expect(enrollment?.completed_at).not.toBeNull();
    expect(enrollment?.last_lesson_id).toBe(state.lesson_ids.at(-1));
  });

  it('7. "Mis cursos" lo pinta en la lista de terminados', async () => {
    const response = await myCourses(state.student_token);
    const data = myCoursesSchema.parse(envelopeSchema.parse(response.body).data);

    expect(data.in_progress).toEqual([]);
    expect(data.completed).toHaveLength(1);
    expect(data.completed[0]).toMatchObject({
      course: { slug: COURSE_SLUG },
      lesson_count: state.lesson_ids.length,
    });
  });

  it('8. publicar una lección nueva lo devuelve a "en curso" SIN borrar la fecha', async () => {
    const before = await storedEnrollment();

    await prisma.lessons.create({
      data: {
        course_id: state.course_id,
        slug: EXTRA_LESSON_SLUG,
        title: 'Lección nueva de la fase 11',
        description: 'Una lección publicada después de terminar el curso.',
        type: lesson_type.ARTICLE,
        position: state.lesson_ids.length + 1,
        status: lesson_status.PUBLISHED,
        article_body: 'Texto de prueba de la fase 11.',
        article_word_count: 7,
        reading_minutes: 1,
      },
    });

    const response = await myCourses(state.student_token);
    const data = myCoursesSchema.parse(envelopeSchema.parse(response.body).data);

    expect(data.completed).toEqual([]);
    expect(data.in_progress).toHaveLength(1);
    expect(data.in_progress[0]).toMatchObject({
      completed_lessons: state.lesson_ids.length,
      lesson_count: state.lesson_ids.length + 1,
      next_lesson: { slug: EXTRA_LESSON_SLUG },
    });

    const after = await storedEnrollment();

    expect(after?.completed_at).toEqual(before?.completed_at);

    await removeExtraLesson();
  });

  it('9. desmarcar una lección devuelve el curso a "en curso" y borra su fecha', async () => {
    const lesson_id = state.lesson_ids[0] ?? '';
    const response = await uncompleteLessonRequest(state.student_token, lesson_id);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    await expect(storedEnrollment()).resolves.toMatchObject({ completed_at: null });

    const list = await myCourses(state.student_token);
    const data = myCoursesSchema.parse(envelopeSchema.parse(list.body).data);

    expect(data.completed).toEqual([]);
    expect(data.in_progress[0]).toMatchObject({
      completed_lessons: state.lesson_ids.length - 1,
      next_lesson: { slug: 'que-es-legal-tech-y-que-no' },
    });
  });

  it('10. volver a completarla sella el curso otra vez', async () => {
    const response = await completeLessonRequest(state.student_token, state.lesson_ids[0] ?? '');

    expect(response.status).toBe(HttpStatusCodes.OK.code);

    const enrollment = await storedEnrollment();

    expect(enrollment?.completed_at).not.toBeNull();
  });

  it('11. una lección de un curso archivado responde 403 LESSON_LOCKED', async () => {
    await prisma.courses.update({
      where: { id: state.course_id },
      data: { status: course_status.ARCHIVED },
    });

    const response = await completeLessonRequest(state.student_token, state.lesson_ids[0] ?? '');

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(envelopeSchema.parse(response.body).meta?.code).toBe(ErrorCodes.LESSON_LOCKED);

    await prisma.courses.update({
      where: { id: state.course_id },
      data: { status: course_status.PUBLISHED },
    });
  });

  it('12. una lección que no existe responde 404 NOT_FOUND', async () => {
    const response = await completeLessonRequest(state.student_token, 'les_que_no_existe');

    expect(response.status).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(envelopeSchema.parse(response.body).meta?.code).toBe(ErrorCodes.NOT_FOUND);
  });

  it('13. borrar la cuenta se lleva por delante su progreso', async () => {
    await removeTestUsers();

    await expect(
      prisma.enrollments.count({ where: { course_id: state.course_id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.lesson_progress.count({ where: { lesson_id: { in: state.lesson_ids } } }),
    ).resolves.toBe(0);
  });
});
