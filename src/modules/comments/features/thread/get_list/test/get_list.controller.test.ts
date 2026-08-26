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

jest.mock('@/modules/comments/features/thread/get_list/presentation/get_list.service', () => ({
  getCommentsService: jest.fn(),
}));

jest.mock('@/middlewares/rate_limit', () => ({
  commentRateLimit: (_req: unknown, _res: unknown, next: () => void): void => {
    next();
  },
}));

import { ApiPrefix, LessonsRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { CourseMessages } from '@/constants/messages/courses';
import { lessonThreadRouter } from '@/modules/comments/features/thread';
import { getCommentsService } from '@/modules/comments/features/thread/get_list/presentation/get_list.service';
import { buildCommentsApp } from '@/modules/comments/shared/test/comments_test_app';
import { AppError } from '@/utils/errors';

const getCommentsServiceMock = jest.mocked(getCommentsService);

const LESSON_ID = 'les_1';
const LIST_PATH = `${ApiPrefix}${LessonsRoutePrefix}/${LESSON_ID}/comments`;

const RESULT = {
  comments: [
    {
      id: 'cmt_1',
      parent_id: null,
      body: '¿Esto aplica a un estudio de dos personas?',
      created_at: '2026-07-01T10:00:00.000Z',
      author: {
        full_name: 'Jorge Ramírez',
        avatar_url: null,
        affiliation: 'Estudio Ramírez Abogados',
        is_team: false,
      },
      replies: [
        {
          id: 'cmt_2',
          parent_id: 'cmt_1',
          body: 'Sí, aplica igual.',
          created_at: '2026-07-01T11:00:00.000Z',
          author: {
            full_name: 'Admin Arxatec',
            avatar_url: null,
            affiliation: 'Arxatec',
            is_team: true,
          },
        },
      ],
    },
  ],
};

const call = () => request(buildCommentsApp(LessonsRoutePrefix, lessonThreadRouter)).get(LIST_PATH);

beforeEach(() => {
  getCommentsServiceMock.mockResolvedValue(RESULT);
});

describe('GET /lessons/:lesson_id/comments', () => {
  it('responde 200 sin ningún token: el listado es público', async () => {
    const response = await call();

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.OK.code,
      description: CommentMessages.thread.list_success,
      path: LIST_PATH,
      data: RESULT,
    });
  });

  it('el JSON serializado de la respuesta no contiene ninguna arroba', async () => {
    const response = await call();
    const serialized = JSON.stringify(response.body);

    expect(serialized).toContain('Jorge Ramírez');
    expect(serialized).not.toContain('@');
  });

  it('el service recibe el id de la lección de la ruta', async () => {
    await call();

    expect(getCommentsServiceMock).toHaveBeenCalledWith({ lesson_id: LESSON_ID });
  });

  it('una lección sin comentarios responde 200 con la lista vacía (E5)', async () => {
    getCommentsServiceMock.mockResolvedValue({ comments: [] });

    const response = await call();

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({ data: { comments: [] } });
  });

  it('propaga el 404 de una lección que no existe con el sobre normal', async () => {
    getCommentsServiceMock.mockRejectedValue(
      new AppError(CourseMessages.lesson.not_found, HttpStatusCodes.NOT_FOUND.code, {
        code: ErrorCodes.NOT_FOUND,
      }),
    );

    const response = await call();

    expect(response.status).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(response.body).toMatchObject({
      description: CourseMessages.lesson.not_found,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
  });
});
