import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app/create_app';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { AuthHeaders } from '@/constants/auth';
import { course_level, course_status, course_topic, user_city, user_role } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';
import { postJson, sessionDataSchema } from './helpers/auth_client';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

const root = '/api/v1/admin/courses';
const email = `teachers-${Date.now()}@example.test`;
const teacherInput = {
  full_name: 'Ana Pérez',
  biography: 'Docente de tecnología jurídica.',
  photo_url: 'https://example.test/ana.jpg',
};
const teacherRecord = z.object({
  id: z.string(),
  full_name: z.string(),
  biography: z.string(),
  photo_url: z.string().nullable(),
});
const courseResponse = z.object({
  data: z.object({
    course: z.object({
      id: z.string(),
      slug: z.string(),
      updated_at: z.string(),
      teacher: teacherRecord.nullable(),
    }),
  }),
});
type Course = z.infer<typeof courseResponse>['data']['course'];
let app: Express;
let token = '';
const courseIds: string[] = [];
const teacherIds: string[] = [];
const authorized = () => ({ [AuthHeaders.authorization]: `${AuthHeaders.bearer_prefix}${token}` });

const createCourse = async (): Promise<Course> => {
  const response = await request(app)
    .post(root)
    .set(authorized())
    .send({
      title: `Curso docente ${Date.now()} ${courseIds.length}`,
      topic: course_topic.FIRST_STEPS,
      level: course_level.INTRODUCTORY,
    });
  expect(response.status).toBe(201);
  const course = courseResponse.parse(response.body).data.course;
  courseIds.push(course.id);
  return course;
};

const assignTeacher = async (course: Course): Promise<Course> => {
  const response = await request(app).patch(`${root}/${course.id}`).set(authorized()).send({
    expected_updated_at: course.updated_at,
    teacher: teacherInput,
  });
  expect(response.status).toBe(200);
  const updated = courseResponse.parse(response.body).data.course;
  if (!updated.teacher) {
    throw new Error('Missing teacher');
  }
  teacherIds.push(updated.teacher.id);
  expect(updated.updated_at).not.toBe(course.updated_at);
  return updated;
};

beforeAll(async () => {
  app = createApp();
  jest.mocked(sendEmail).mockResolvedValue(undefined);
  const registration = await postJson(app, 'register', {
    full_name: 'Admin docentes',
    email,
    password: 'claveLargaDePrueba',
    is_independent: true,
    city: user_city.LIMA,
  });
  const session = sessionDataSchema.parse(registration.body.data);
  token = session.token;
  await prisma.users.update({ where: { id: session.user.id }, data: { role: user_role.ADMIN } });
});

afterAll(async () => {
  await prisma.courses.deleteMany({ where: { id: { in: courseIds } } });
  await prisma.teachers.deleteMany({ where: { id: { in: teacherIds } } });
  await prisma.users.deleteMany({ where: { email } });
  await disconnectPrisma();
});

it('crea, reutiliza y publica los tres datos del docente', async () => {
  const first = await assignTeacher(await createCourse());
  const second = await createCourse();
  const response = await request(app)
    .patch(`${root}/${second.id}`)
    .set(authorized())
    .send({
      expected_updated_at: second.updated_at,
      teacher: { ...first.teacher, biography: 'Biografía actualizada.' },
    });
  expect(response.status).toBe(200);
  const assigned = courseResponse.parse(response.body).data.course;
  expect(assigned.teacher?.id).toBe(first.teacher?.id);
  expect(await prisma.teachers.count({ where: { id: first.teacher?.id } })).toBe(1);
  await prisma.courses.update({
    where: { id: first.id },
    data: { status: course_status.PUBLISHED },
  });
  const publicResponse = await request(app).get(`/api/v1/courses/${first.slug}`);
  expect(publicResponse.status).toBe(200);
  const publicTeacher = z
    .object({ data: z.object({ course: z.object({ teacher: z.unknown() }) }) })
    .parse(publicResponse.body).data.course.teacher;
  expect(publicTeacher).toEqual({ ...teacherInput, biography: 'Biografía actualizada.' });
  const listed = await request(app).get('/api/v1/admin/teachers').set(authorized());
  expect(listed.status).toBe(200);
  expect(
    z.object({ data: z.object({ teachers: z.array(teacherRecord) }) }).parse(listed.body).data
      .teachers,
  ).toContainEqual(assigned.teacher);
});

it('una edición obsoleta no crea docentes ni modifica el existente', async () => {
  const original = await createCourse();
  const assigned = await assignTeacher(original);
  const full_name = `No crear ${Date.now()}`;
  const stale = await request(app)
    .patch(`${root}/${original.id}`)
    .set(authorized())
    .send({
      expected_updated_at: original.updated_at,
      teacher: { ...teacherInput, full_name },
    });
  expect(stale.status).toBe(409);
  expect(await prisma.teachers.count({ where: { full_name } })).toBe(0);
  expect(
    (
      await prisma.courses.findUniqueOrThrow({
        where: { id: original.id },
        select: { teacher_id: true },
      })
    ).teacher_id,
  ).toBe(assigned.teacher?.id);
});

it('rechaza docentes inexistentes y fotos que no usan HTTP(S)', async () => {
  const course = await createCourse();
  const missing = await request(app)
    .patch(`${root}/${course.id}`)
    .set(authorized())
    .send({
      expected_updated_at: course.updated_at,
      teacher: { ...teacherInput, id: 'missing-teacher' },
    });
  expect(missing.status).toBe(404);
  const invalid = await request(app)
    .patch(`${root}/${course.id}`)
    .set(authorized())
    .send({
      expected_updated_at: course.updated_at,
      teacher: { ...teacherInput, photo_url: 'javascript:alert(1)' },
    });
  expect(invalid.status).toBe(422);
});

it('permite desasignar al docente conservando su registro', async () => {
  const course = await assignTeacher(await createCourse());
  const response = await request(app).patch(`${root}/${course.id}`).set(authorized()).send({
    expected_updated_at: course.updated_at,
    teacher: null,
  });
  expect(response.status).toBe(200);
  expect(courseResponse.parse(response.body).data.course.teacher).toBeNull();
  expect(await prisma.teachers.count({ where: { id: course.teacher?.id } })).toBe(1);
});

it('duplicar un curso conserva el docente sin duplicar su perfil', async () => {
  const course = await assignTeacher(await createCourse());
  const response = await request(app).post(`${root}/${course.id}/duplicate`).set(authorized());
  expect(response.status).toBe(201);
  const copied = courseResponse.parse(response.body).data.course;
  courseIds.push(copied.id);
  expect(copied.teacher).toEqual(course.teacher);
});
