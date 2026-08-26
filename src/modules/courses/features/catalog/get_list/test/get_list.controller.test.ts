import express, { type Express } from 'express';
import request from 'supertest';

import { ApiPrefix, CoursesRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { course_level, course_topic } from '@/generated/enums';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { getListRouter } from '@/modules/courses/features/catalog/get_list/presentation/get_list.routes';
import { getListService } from '@/modules/courses/features/catalog/get_list/presentation/get_list.service';
import type { GetListResult } from '@/modules/courses/features/catalog/get_list/domain/get_list.types';

jest.mock('@/modules/courses/features/catalog/get_list/presentation/get_list.service', () => ({
  getListService: jest.fn(),
}));

const getListServiceMock = jest.mocked(getListService);

const path = `${ApiPrefix}${CoursesRoutePrefix}`;

const emptyResult: GetListResult = {
  courses: [],
  facets: {
    topic: { ALL: 6, FIRST_STEPS: 1, LEGAL_ENGINEERING: 2, APPLIED_AI: 1, ARXATEC_PRODUCT: 2 },
    level: { INTRODUCTORY: 4, INTERMEDIATE: 2 },
  },
};

const buildApp = (): Express => {
  const app = express();

  app.use(path, getListRouter);
  registerErrorHandler(app);

  return app;
};

beforeEach(() => {
  jest.clearAllMocks();
  getListServiceMock.mockResolvedValue(emptyResult);
});

describe('GET /courses', () => {
  it('responde 200 con el sobre del contrato y sin meta', async () => {
    const response = await request(buildApp()).get(path);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.OK.code,
      message: HttpStatusCodes.OK.message,
      description: CourseMessages.catalog.success,
      path,
      data: emptyResult,
    });
    expect(response.body).not.toHaveProperty('meta');
  });

  it('una búsqueda sin resultados es 200, no un error, y trae las facetas completas', async () => {
    const response = await request(buildApp()).get(path).query({ search: 'blockchain' });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      data: { courses: [], facets: emptyResult.facets },
    });
  });

  it('sin query, el service recibe listas vacías y sin búsqueda', async () => {
    await request(buildApp()).get(path);

    expect(getListServiceMock).toHaveBeenCalledWith({ topic: [], level: [], search: undefined });
  });

  it('acepta varios valores repetidos y separados por coma', async () => {
    await request(buildApp()).get(
      `${path}?topic=${course_topic.APPLIED_AI}&topic=${course_topic.LEGAL_ENGINEERING},${course_topic.FIRST_STEPS}&level=${course_level.INTERMEDIATE}`,
    );

    expect(getListServiceMock).toHaveBeenCalledWith({
      topic: [course_topic.APPLIED_AI, course_topic.LEGAL_ENGINEERING, course_topic.FIRST_STEPS],
      level: [course_level.INTERMEDIATE],
      search: undefined,
    });
  });

  it('un tema desconocido es 422 VALIDATION_ERROR con su clave i18n', async () => {
    const response = await request(buildApp()).get(path).query({ topic: 'BLOCKCHAIN' });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: {
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { 'topic.0': 'courses.errors.topic_invalid' },
      },
    });
    expect(getListServiceMock).not.toHaveBeenCalled();
  });

  it('no lleva try/catch: un fallo del service sale por el manejador global', async () => {
    getListServiceMock.mockRejectedValue(new Error('boom'));

    const response = await request(buildApp()).get(path);

    expect(response.status).toBe(HttpStatusCodes.INTERNAL_SERVER_ERROR.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.INTERNAL_ERROR } });
  });
});
