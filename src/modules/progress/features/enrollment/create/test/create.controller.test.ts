import request from 'supertest';

jest.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'secreto-de-pruebas-con-mas-de-32-caracteres',
    JWT_ISSUER: 'arxatec-academy-test',
    LOG_LEVEL: 'silent',
  },
  isDevelopment: false,
  isProduction: false,
  isTest: true,
}));

jest.mock('@/modules/auth/shared/data/sessions.repository', () => ({
  findSessionById: jest.fn(),
  touchSession: jest.fn(),
}));

jest.mock('@/modules/progress/features/enrollment/create/presentation/create.service', () => ({
  createEnrollmentService: jest.fn(),
}));

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, CoursesRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { ProgressMessages } from '@/constants/messages/progress';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { enrollmentRouter } from '@/modules/progress/features/enrollment';
import { createEnrollmentService } from '@/modules/progress/features/enrollment/create/presentation/create.service';
import {
  buildProgressApp,
  testBearer,
  testSession,
  TEST_USER_ID,
} from '@/modules/progress/shared/test/progress_test_app';
import { AppError } from '@/utils/errors';

const findSessionByIdMock = jest.mocked(findSessionById);
const createEnrollmentServiceMock = jest.mocked(createEnrollmentService);

const COURSE_SLUG = 'fundamentos-de-legal-tech';
const ENROLL_PATH = `${ApiPrefix}${CoursesRoutePrefix}/${COURSE_SLUG}/enroll`;

const RESULT = {
  enrollment: {
    course: { slug: COURSE_SLUG, title: 'Fundamentos de legal tech' },
    started_at: '2026-07-01T10:00:00.000Z',
    completed_at: null,
    completed_lessons: 0,
    lesson_count: 6,
    next_lesson: { slug: 'que-es-legal-tech-y-que-no', title: 'Qué es legal tech y qué no' },
  },
};

const app = () => buildProgressApp(CoursesRoutePrefix, enrollmentRouter);

const call = (bearer?: string) => {
  const pending = request(app()).post(ENROLL_PATH);

  return bearer === undefined ? pending : pending.set(AuthHeaders.authorization, bearer);
};

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  createEnrollmentServiceMock.mockResolvedValue(RESULT);
});

describe('POST /courses/:slug/enroll', () => {
  it('con Bearer válido responde 200 con la inscripción', async () => {
    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.OK.code,
      description: ProgressMessages.enrollment.success,
      path: ENROLL_PATH,
      data: RESULT,
    });
  });

  it('el service recibe el usuario de la sesión y el slug de la ruta', async () => {
    await call(testBearer());

    expect(createEnrollmentServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      slug: COURSE_SLUG,
    });
  });

  it('sin Bearer responde 401 UNAUTHENTICATED y no llama al service', async () => {
    const response = await call();

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.UNAUTHENTICATED } });
    expect(createEnrollmentServiceMock).not.toHaveBeenCalled();
  });

  it('una sesión revocada responde 401 y no llama al service', async () => {
    findSessionByIdMock.mockResolvedValue({ ...testSession(), revoked_at: new Date() });

    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(createEnrollmentServiceMock).not.toHaveBeenCalled();
  });

  it('propaga el 404 del curso inexistente con el sobre normal', async () => {
    createEnrollmentServiceMock.mockRejectedValue(
      new AppError(CourseMessages.course.not_found, HttpStatusCodes.NOT_FOUND.code, {
        code: ErrorCodes.NOT_FOUND,
      }),
    );

    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(response.body).toMatchObject({
      description: CourseMessages.course.not_found,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
  });

  it('un usuario sin el correo verificado también puede empezar un curso (D-006)', async () => {
    findSessionByIdMock.mockResolvedValue(testSession(null));

    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
  });
});
