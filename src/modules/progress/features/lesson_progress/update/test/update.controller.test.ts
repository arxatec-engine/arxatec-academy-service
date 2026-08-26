import type { NextFunction, Request, Response } from 'express';
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

jest.mock('@/middlewares/rate_limit', () => ({
  lessonProgressRateLimit: (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  },
}));

jest.mock(
  '@/modules/progress/features/lesson_progress/update/presentation/update.service',
  () => ({ updateLessonProgressService: jest.fn() }),
);

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, LessonsRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ProgressMessages } from '@/constants/messages/progress';
import { ValidationKeys } from '@/constants/validation_keys';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { updateLessonProgressRouter } from '@/modules/progress/features/lesson_progress/update/presentation/update.routes';
import { updateLessonProgressService } from '@/modules/progress/features/lesson_progress/update/presentation/update.service';
import {
  buildProgressApp,
  testBearer,
  testSession,
  TEST_USER_ID,
} from '@/modules/progress/shared/test/progress_test_app';

const findSessionByIdMock = jest.mocked(findSessionById);
const updateLessonProgressServiceMock = jest.mocked(updateLessonProgressService);

const LESSON_ID = 'les_3';
const PROGRESS_PATH = `${ApiPrefix}${LessonsRoutePrefix}/${LESSON_ID}/progress`;

const RESULT = {
  progress: {
    lesson_id: LESSON_ID,
    last_position_seconds: 252,
    completed_at: null,
    updated_at: '2026-07-02T10:00:05.000Z',
  },
};

const call = (body: Record<string, unknown>, bearer = testBearer()) =>
  request(buildProgressApp(LessonsRoutePrefix, updateLessonProgressRouter))
    .put(PROGRESS_PATH)
    .set(AuthHeaders.authorization, bearer)
    .send(body);

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  updateLessonProgressServiceMock.mockResolvedValue(RESULT);
});

describe('PUT /lessons/:lesson_id/progress', () => {
  it('responde 200 con el minuto guardado', async () => {
    const response = await call({ last_position_seconds: 252, completed: false });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      description: ProgressMessages.lesson_progress.success,
      path: PROGRESS_PATH,
      data: RESULT,
    });
  });

  it('el service recibe el usuario de la sesión, la lección de la ruta y el cuerpo', async () => {
    await call({ last_position_seconds: 252, completed: true });

    expect(updateLessonProgressServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      lesson_id: LESSON_ID,
      has_session: true,
      last_position_seconds: 252,
      completed: true,
    });
  });

  it('sin completed, el reproductor solo guarda el minuto', async () => {
    await call({ last_position_seconds: 30 });

    expect(updateLessonProgressServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ completed: false }),
    );
  });

  it('un minuto negativo es 422 VALIDATION_ERROR con la clave i18n', async () => {
    const response = await call({ last_position_seconds: -1 });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: {
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { last_position_seconds: ValidationKeys.progress.position_invalid },
      },
    });
    expect(updateLessonProgressServiceMock).not.toHaveBeenCalled();
  });

  it('un minuto que no es entero es 422 VALIDATION_ERROR', async () => {
    const response = await call({ last_position_seconds: 12.5 });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(updateLessonProgressServiceMock).not.toHaveBeenCalled();
  });

  it('sin cuerpo es 422: last_position_seconds es obligatorio', async () => {
    const response = await call({});

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
  });

  it('sin Bearer responde 401 y no llama al service', async () => {
    const response = await request(
      buildProgressApp(LessonsRoutePrefix, updateLessonProgressRouter),
    )
      .put(PROGRESS_PATH)
      .send({ last_position_seconds: 252 });

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(updateLessonProgressServiceMock).not.toHaveBeenCalled();
  });
});
