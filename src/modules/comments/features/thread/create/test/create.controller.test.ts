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

jest.mock('@/middlewares/rate_limit', () => ({
  commentRateLimit: (_req: unknown, _res: unknown, next: () => void): void => {
    next();
  },
}));

import { AuthHeaders } from '@/constants/auth';
import { CommentPolicy } from '@/constants/comments';
import { ApiPrefix, LessonsRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { CommentMessages } from '@/constants/messages/comments';
import { ValidationKeys } from '@/constants/validation_keys';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { lessonThreadRouter } from '@/modules/comments/features/thread';
import { createCommentService } from '@/modules/comments/features/thread/create/presentation/create.service';
import {
  buildCommentsApp,
  testBearer,
  testSession,
  TEST_USER_ID,
} from '@/modules/comments/shared/test/comments_test_app';

const findSessionByIdMock = jest.mocked(findSessionById);
const createCommentServiceMock = jest.mocked(createCommentService);

const LESSON_ID = 'les_1';
const CREATE_PATH = `${ApiPrefix}${LessonsRoutePrefix}/${LESSON_ID}/comments`;
const BODY = '¿Esto aplica a un estudio de dos personas?';

const RESULT = {
  comment: {
    id: 'cmt_1',
    parent_id: null,
    body: BODY,
    created_at: '2026-07-01T10:00:00.000Z',
    author: {
      full_name: 'Jorge Ramírez',
      avatar_url: null,
      affiliation: null,
      is_team: false,
    },
  },
};

const call = (bearer: string | undefined, body: Record<string, unknown> = { body: BODY }) => {
  const pending = request(buildCommentsApp(LessonsRoutePrefix, lessonThreadRouter))
    .post(CREATE_PATH)
    .send(body);

  return bearer === undefined ? pending : pending.set(AuthHeaders.authorization, bearer);
};

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  createCommentServiceMock.mockResolvedValue(RESULT);
});

describe('POST /lessons/:lesson_id/comments', () => {
  it('con el correo verificado responde 201 con el comentario', async () => {
    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.CREATED.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.CREATED.code,
      description: CommentMessages.thread.created,
      path: CREATE_PATH,
      data: RESULT,
    });
  });

  it('el service recibe el usuario de la sesión, la lección de la ruta y el cuerpo recortado', async () => {
    await call(testBearer(), { body: `   ${BODY}   ` });

    expect(createCommentServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      lesson_id: LESSON_ID,
      body: BODY,
    });
  });

  it('sin sesión responde 401 UNAUTHENTICATED y no llama al service', async () => {
    const response = await call(undefined);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.UNAUTHENTICATED } });
    expect(createCommentServiceMock).not.toHaveBeenCalled();
  });

  it('con la sesión SIN verificar responde 403 EMAIL_NOT_VERIFIED y no llama al service', async () => {
    findSessionByIdMock.mockResolvedValue(testSession({ email_verified_at: null }));

    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(response.body).toMatchObject({
      description: AuthMessages.email_verification.required,
      meta: { code: ErrorCodes.EMAIL_NOT_VERIFIED },
    });
    expect(createCommentServiceMock).not.toHaveBeenCalled();
  });

  it('un cuerpo vacío responde 422 con la clave i18n del campo', async () => {
    const response = await call(testBearer(), { body: '' });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: {
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { body: ValidationKeys.comments.body_required },
      },
    });
    expect(createCommentServiceMock).not.toHaveBeenCalled();
  });

  it('un cuerpo de solo espacios responde 422: se recorta antes de medir', async () => {
    const response = await call(testBearer(), { body: '        ' });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: { fields: { body: ValidationKeys.comments.body_required } },
    });
  });

  it('un cuerpo sin el campo responde 422', async () => {
    const response = await call(testBearer(), {});

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(createCommentServiceMock).not.toHaveBeenCalled();
  });

  it(`${String(CommentPolicy.body_max_length)} caracteres pasan y uno más responde 422`, async () => {
    const limit = await call(testBearer(), { body: 'a'.repeat(CommentPolicy.body_max_length) });
    const over = await call(testBearer(), {
      body: 'a'.repeat(CommentPolicy.body_max_length + 1),
    });

    expect(limit.status).toBe(HttpStatusCodes.CREATED.code);
    expect(over.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(over.body).toMatchObject({
      meta: { fields: { body: ValidationKeys.comments.body_too_long } },
    });
  });
});
