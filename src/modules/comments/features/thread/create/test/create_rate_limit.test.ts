import request from 'supertest';

jest.mock('@/config/env', () => ({
  env: {
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_PATH: 'storage',
    STORAGE_PUBLIC_URL: 'http://localhost:3001/files',
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

jest.mock('@/modules/comments/features/thread/create/presentation/create.service', () => ({
  createCommentService: jest.fn(),
}));

jest.mock('@/modules/comments/features/thread/get_list/presentation/get_list.service', () => ({
  getCommentsService: jest.fn(),
}));

import { AuthHeaders } from '@/constants/auth';
import { CommentRateLimits } from '@/constants/comments';
import { ApiPrefix, LessonsRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { lessonThreadRouter } from '@/modules/comments/features/thread';
import { createCommentService } from '@/modules/comments/features/thread/create/presentation/create.service';
import {
  buildCommentsApp,
  testBearer,
  testSession,
} from '@/modules/comments/shared/test/comments_test_app';

const findSessionByIdMock = jest.mocked(findSessionById);
const createCommentServiceMock = jest.mocked(createCommentService);

const LESSON_ID = 'les_1';
const CREATE_PATH = `${ApiPrefix}${LessonsRoutePrefix}/${LESSON_ID}/comments`;

const RESULT = {
  comment: {
    id: 'cmt_1',
    parent_id: null,
    body: 'Una pregunta corta',
    created_at: '2026-07-01T10:00:00.000Z',
    author: null,
  },
};

const app = buildCommentsApp(LessonsRoutePrefix, lessonThreadRouter);

const comment = async () =>
  request(app)
    .post(CREATE_PATH)
    .set(AuthHeaders.authorization, testBearer())
    .send({ body: 'Una pregunta corta' });

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  createCommentServiceMock.mockResolvedValue(RESULT);
});

describe('límite de comentarios por hora', () => {
  it(`el comentario número ${String(CommentRateLimits.create.max + 1)} de la hora responde 429 RATE_LIMITED`, async () => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < CommentRateLimits.create.max + 1; attempt += 1) {
      statuses.push((await comment()).status);
    }

    expect(statuses.slice(0, CommentRateLimits.create.max)).toEqual(
      Array.from({ length: CommentRateLimits.create.max }, () => HttpStatusCodes.CREATED.code),
    );
    expect(statuses.at(-1)).toBe(HttpStatusCodes.TOO_MANY_REQUESTS.code);
  });

  it('el 429 trae el código y el aviso del contrato, y el service ya no se llama', async () => {
    const response = await comment();

    expect(response.status).toBe(HttpStatusCodes.TOO_MANY_REQUESTS.code);
    expect(response.body).toMatchObject({
      description: CommentMessages.rate_limit.create,
      meta: {
        code: ErrorCodes.RATE_LIMITED,
        retry_after_seconds: CommentRateLimits.create.window_seconds,
      },
    });
    expect(createCommentServiceMock).not.toHaveBeenCalled();
  });
});
