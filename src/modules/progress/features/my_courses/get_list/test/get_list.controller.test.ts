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

jest.mock('@/modules/progress/features/my_courses/get_list/presentation/get_list.service', () => ({
  getMyCoursesService: jest.fn(),
}));

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, MeRoutePrefix, ProgressEndpoints } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ProgressMessages } from '@/constants/messages/progress';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { myCoursesRouter } from '@/modules/progress/features/my_courses';
import { getMyCoursesService } from '@/modules/progress/features/my_courses/get_list/presentation/get_list.service';
import {
  buildProgressApp,
  testBearer,
  testSession,
  TEST_USER_ID,
} from '@/modules/progress/shared/test/progress_test_app';

const findSessionByIdMock = jest.mocked(findSessionById);
const getMyCoursesServiceMock = jest.mocked(getMyCoursesService);

const MY_COURSES_PATH = `${ApiPrefix}${MeRoutePrefix}${ProgressEndpoints.my_courses}`;

const app = () => buildProgressApp(MeRoutePrefix, myCoursesRouter);

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  getMyCoursesServiceMock.mockResolvedValue({ in_progress: [], completed: [] });
});

describe('GET /me/courses', () => {
  it('sin nada empezado responde 200 con dos listas vacías (E3 no es un error)', async () => {
    const response = await request(app())
      .get(MY_COURSES_PATH)
      .set(AuthHeaders.authorization, testBearer());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      description: ProgressMessages.my_courses.success,
      path: MY_COURSES_PATH,
      data: { in_progress: [], completed: [] },
    });
    expect(response.body).not.toHaveProperty('meta');
  });

  it('el service recibe el usuario de la sesión', async () => {
    await request(app()).get(MY_COURSES_PATH).set(AuthHeaders.authorization, testBearer());

    expect(getMyCoursesServiceMock).toHaveBeenCalledWith({ user_id: TEST_USER_ID });
  });

  it('devuelve las dos listas tal cual las arma el service', async () => {
    getMyCoursesServiceMock.mockResolvedValue({
      in_progress: [
        {
          course: { slug: 'fundamentos-de-legal-tech', title: 'Fundamentos de legal tech' },
          completed_lessons: 2,
          lesson_count: 6,
          next_lesson: { slug: 'las-cuatro-herramientas', title: 'Las cuatro herramientas' },
        },
      ],
      completed: [
        {
          course: { slug: 'expedientes-sin-excel', title: 'Expedientes sin Excel' },
          lesson_count: 4,
          completed_at: '2026-07-03T00:00:00.000Z',
        },
      ],
    });

    const response = await request(app())
      .get(MY_COURSES_PATH)
      .set(AuthHeaders.authorization, testBearer());

    expect(response.body).toMatchObject({
      data: {
        in_progress: [{ completed_lessons: 2, lesson_count: 6 }],
        completed: [{ completed_at: '2026-07-03T00:00:00.000Z' }],
      },
    });
  });

  it('sin Bearer responde 401 UNAUTHENTICATED', async () => {
    const response = await request(app()).get(MY_COURSES_PATH);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.UNAUTHENTICATED } });
    expect(getMyCoursesServiceMock).not.toHaveBeenCalled();
  });

  it('un Bearer con basura responde 401 y no llama al service', async () => {
    const response = await request(app())
      .get(MY_COURSES_PATH)
      .set(AuthHeaders.authorization, `${AuthHeaders.bearer_prefix}no-es-un-token`);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(getMyCoursesServiceMock).not.toHaveBeenCalled();
  });
});
