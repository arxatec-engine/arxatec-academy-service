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

jest.mock('@/modules/comments/features/report/create/presentation/create.service', () => ({
  createCommentReportService: jest.fn(),
}));

import { AuthHeaders } from '@/constants/auth';
import { CommentPolicy } from '@/constants/comments';
import { ApiPrefix, CommentsRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { ValidationKeys } from '@/constants/validation_keys';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { commentReportRouter } from '@/modules/comments/features/report';
import { createCommentReportService } from '@/modules/comments/features/report/create/presentation/create.service';
import {
  buildCommentsApp,
  testBearer,
  testSession,
  TEST_USER_ID,
} from '@/modules/comments/shared/test/comments_test_app';
import { AppError } from '@/utils/errors';

const findSessionByIdMock = jest.mocked(findSessionById);
const createCommentReportServiceMock = jest.mocked(createCommentReportService);

const COMMENT_ID = 'cmt_1';
const REPORT_PATH = `${ApiPrefix}${CommentsRoutePrefix}/${COMMENT_ID}/report`;

const call = (bearer: string | undefined, body: Record<string, unknown> = {}) => {
  const pending = request(buildCommentsApp(CommentsRoutePrefix, commentReportRouter))
    .post(REPORT_PATH)
    .send(body);

  return bearer === undefined ? pending : pending.set(AuthHeaders.authorization, bearer);
};

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  createCommentReportServiceMock.mockResolvedValue(undefined);
});

describe('POST /comments/:comment_id/report', () => {
  it('responde 200 sin data: no confirma nada sobre el hilo', async () => {
    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.OK.code,
      description: CommentMessages.report.success,
      path: REPORT_PATH,
    });
    expect(response.body).not.toHaveProperty('data');
  });

  it('reportar dos veces responde 200 las dos, con el mismo cuerpo', async () => {
    const first = await call(testBearer());
    const second = await call(testBearer());

    expect(first.status).toBe(HttpStatusCodes.OK.code);
    expect(second.status).toBe(HttpStatusCodes.OK.code);
    expect(first.body).toMatchObject({ description: CommentMessages.report.success });
    expect(second.body).toMatchObject({ description: CommentMessages.report.success });
  });

  it('el service recibe el usuario de la sesión, el comentario y el motivo', async () => {
    await call(testBearer(), { reason: '  Es publicidad  ' });

    expect(createCommentReportServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      comment_id: COMMENT_ID,
      reason: 'Es publicidad',
    });
  });

  it('sin motivo el service recibe null', async () => {
    await call(testBearer());

    expect(createCommentReportServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      comment_id: COMMENT_ID,
      reason: null,
    });
  });

  it('sin sesión responde 401 y no llama al service', async () => {
    const response = await call(undefined);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(createCommentReportServiceMock).not.toHaveBeenCalled();
  });

  it('reportar NO exige el correo verificado: avisar de algo grave no espera a un enlace', async () => {
    findSessionByIdMock.mockResolvedValue(testSession({ email_verified_at: null }));

    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(createCommentReportServiceMock).toHaveBeenCalled();
  });

  it('un motivo demasiado largo responde 422 con su clave i18n', async () => {
    const response = await call(testBearer(), {
      reason: 'a'.repeat(CommentPolicy.reason_max_length + 1),
    });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: { fields: { reason: ValidationKeys.comments.reason_too_long } },
    });
    expect(createCommentReportServiceMock).not.toHaveBeenCalled();
  });

  it('propaga el 404 de un comentario inexistente', async () => {
    createCommentReportServiceMock.mockRejectedValue(
      new AppError(CommentMessages.thread.not_found, HttpStatusCodes.NOT_FOUND.code, {
        code: ErrorCodes.NOT_FOUND,
      }),
    );

    const response = await call(testBearer());

    expect(response.status).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.NOT_FOUND } });
  });
});
