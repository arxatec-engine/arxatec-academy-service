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

jest.mock('@/modules/comments/features/thread/reply/presentation/reply.service', () => ({
  replyCommentService: jest.fn(),
}));

jest.mock('@/middlewares/rate_limit', () => ({
  commentRateLimit: (_req: unknown, _res: unknown, next: () => void): void => {
    next();
  },
}));

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, CommentsRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { CommentMessages } from '@/constants/messages/comments';
import { ValidationKeys } from '@/constants/validation_keys';
import { user_role } from '@/generated/enums';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { commentThreadRouter } from '@/modules/comments/features/thread';
import { replyCommentService } from '@/modules/comments/features/thread/reply/presentation/reply.service';
import {
  buildCommentsApp,
  testBearer,
  testSession,
  TEST_USER_ID,
} from '@/modules/comments/shared/test/comments_test_app';
import { AppError } from '@/utils/errors';

const findSessionByIdMock = jest.mocked(findSessionById);
const replyCommentServiceMock = jest.mocked(replyCommentService);

const COMMENT_ID = 'cmt_1';
const REPLY_PATH = `${ApiPrefix}${CommentsRoutePrefix}/${COMMENT_ID}/replies`;
const BODY = 'Sí, aplica igual.';

const RESULT = {
  comment: {
    id: 'cmt_2',
    parent_id: COMMENT_ID,
    body: BODY,
    created_at: '2026-07-01T11:00:00.000Z',
    author: {
      full_name: 'Admin Arxatec',
      avatar_url: null,
      affiliation: 'Arxatec',
      is_team: true,
    },
  },
};

const call = (bearer: string | undefined, body: Record<string, unknown> = { body: BODY }) => {
  const pending = request(buildCommentsApp(CommentsRoutePrefix, commentThreadRouter))
    .post(REPLY_PATH)
    .send(body);

  return bearer === undefined ? pending : pending.set(AuthHeaders.authorization, bearer);
};

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession({ role: user_role.ADMIN }));
  replyCommentServiceMock.mockResolvedValue(RESULT);
});

describe('POST /comments/:comment_id/replies', () => {
  it('responde 201 con la respuesta y su insignia de equipo', async () => {
    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.CREATED.code);
    expect(response.body).toMatchObject({
      description: CommentMessages.thread.replied,
      path: REPLY_PATH,
      data: RESULT,
    });
  });

  it('el service recibe el usuario de la sesión y el comentario de la ruta', async () => {
    await call(testBearer());

    expect(replyCommentServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      comment_id: COMMENT_ID,
      body: BODY,
    });
  });

  it('sin sesión responde 401 y no llama al service', async () => {
    const response = await call(undefined);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(replyCommentServiceMock).not.toHaveBeenCalled();
  });

  it('con la sesión sin verificar responde 403 EMAIL_NOT_VERIFIED', async () => {
    findSessionByIdMock.mockResolvedValue(
      testSession({ email_verified_at: null, role: user_role.ADMIN }),
    );

    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(response.body).toMatchObject({
      description: AuthMessages.email_verification.required,
      meta: { code: ErrorCodes.EMAIL_NOT_VERIFIED },
    });
    expect(replyCommentServiceMock).not.toHaveBeenCalled();
  });

  it('responder a una respuesta devuelve 422 VALIDATION_ERROR con el sobre normal', async () => {
    replyCommentServiceMock.mockRejectedValue(
      new AppError(
        CommentMessages.thread.reply_not_allowed,
        HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
        { code: ErrorCodes.VALIDATION_ERROR },
      ),
    );

    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      description: CommentMessages.thread.reply_not_allowed,
      meta: { code: ErrorCodes.VALIDATION_ERROR },
    });
  });

  it('un cuerpo vacío responde 422 antes de llegar al service', async () => {
    const response = await call(testBearer(), { body: '   ' });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: { fields: { body: ValidationKeys.comments.body_required } },
    });
    expect(replyCommentServiceMock).not.toHaveBeenCalled();
  });
});
