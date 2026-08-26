import express, { type Express } from 'express';
import request from 'supertest';

import { AuthPolicy } from '@/constants/auth';
import { ApiPrefix, AuthEndpoints, AuthRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { ValidationKeys } from '@/constants/validation_keys';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { resetPasswordRouter } from '@/modules/auth/features/password_reset/reset/presentation/reset.routes';
import { resetPassword } from '@/modules/auth/features/password_reset/reset/presentation/reset.service';
import { AppError } from '@/utils/errors';

jest.mock('@/modules/auth/features/password_reset/reset/presentation/reset.service', () => ({
  resetPassword: jest.fn(),
}));

jest.mock('@/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const resetPasswordMock = jest.mocked(resetPassword);

const ROUTE = `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.password_reset}`;

const buildApp = (): Express => {
  const app = express();

  app.use(express.json());
  app.use(`${ApiPrefix}${AuthRoutePrefix}`, resetPasswordRouter);
  registerErrorHandler(app);

  return app;
};

beforeEach(() => {
  resetPasswordMock.mockResolvedValue(undefined);
});

describe('POST /auth/password/reset', () => {
  it('responde 200 con el sobre del contrato y sin data', async () => {
    const response = await request(buildApp())
      .post(ROUTE)
      .send({ token: 'un-token', password: 'unaClaveLarga' });

    const body: unknown = response.body;

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(body).toMatchObject({
      status: HttpStatusCodes.OK.code,
      message: HttpStatusCodes.OK.message,
      description: AuthMessages.password_reset.success,
      path: ROUTE,
    });
    expect(body).not.toHaveProperty('data');
  });

  it('pasa al service solo el token recortado y la contrasena', async () => {
    await request(buildApp())
      .post(ROUTE)
      .send({ token: '  un-token  ', password: 'unaClaveLarga', role: 'ADMIN' });

    expect(resetPasswordMock).toHaveBeenCalledWith({
      token: 'un-token',
      password: 'unaClaveLarga',
    });
  });

  it('responde 422 con la clave i18n del campo cuando la contrasena es corta', async () => {
    const short_password = 'a'.repeat(AuthPolicy.password_min_length - 1);

    const response = await request(buildApp())
      .post(ROUTE)
      .send({ token: 'un-token', password: short_password });

    const body: unknown = response.body;

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(body).toMatchObject({
      meta: {
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { password: ValidationKeys.auth.password_too_short },
      },
    });
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('responde 422 cuando falta el token, sin llegar al service', async () => {
    const response = await request(buildApp()).post(ROUTE).send({ password: 'unaClaveLarga' });

    const body: unknown = response.body;

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(body).toMatchObject({
      meta: { fields: { token: ValidationKeys.auth.token_required } },
    });
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('deja subir el AppError del service al manejador global como 400 TOKEN_INVALID', async () => {
    resetPasswordMock.mockRejectedValue(
      new AppError(AuthMessages.password_reset.token_invalid, HttpStatusCodes.BAD_REQUEST.code, {
        code: ErrorCodes.TOKEN_INVALID,
      }),
    );

    const response = await request(buildApp())
      .post(ROUTE)
      .send({ token: 'un-token', password: 'unaClaveLarga' });

    const body: unknown = response.body;

    expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(body).toMatchObject({
      description: AuthMessages.password_reset.token_invalid,
      meta: { code: ErrorCodes.TOKEN_INVALID },
    });
  });
});
