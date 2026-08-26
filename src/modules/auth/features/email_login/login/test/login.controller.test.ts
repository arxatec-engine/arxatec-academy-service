import express, { type Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { ApiPrefix, AuthEndpoints, AuthRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { auth_provider, user_city, user_role } from '@/generated/enums';
import { registerErrorHandler } from '@/middlewares/error_handler';
import type { LoginResult } from '@/modules/auth/features/email_login/login/domain/login.types';
import { loginController } from '@/modules/auth/features/email_login/login/presentation/login.controller';
import { loginService } from '@/modules/auth/features/email_login/login/presentation/login.service';
import { AppError } from '@/utils/errors';

jest.mock('@/modules/auth/features/email_login/login/presentation/login.service', () => ({
  loginService: jest.fn(),
}));

const loginServiceMock = jest.mocked(loginService);

const LOGIN_PATH = `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.login}`;

const errorEnvelopeSchema = z.object({
  status: z.number(),
  description: z.string(),
  path: z.string(),
  meta: z.object({
    code: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

const readErrorEnvelope = (body: unknown): z.infer<typeof errorEnvelopeSchema> =>
  errorEnvelopeSchema.parse(body);

const sessionResult: LoginResult = {
  token: 'jwt.firmado',
  expires_at: '2026-09-19T12:00:00.000Z',
  user: {
    id: 'usr_1',
    full_name: 'Maria Quispe Rojas',
    email: 'maria@estudioqp.pe',
    role: user_role.STUDENT,
    organization: 'Estudio Quispe & Rojas',
    is_independent: false,
    city: user_city.LIMA,
    city_other: null,
    avatar_url: null,
    email_verified_at: null,
    auth_provider: auth_provider.PASSWORD,
    created_at: '2026-05-12T10:00:00.000Z',
  },
};

const buildApp = (): Express => {
  const app = express();

  app.use(express.json());
  app.post(LOGIN_PATH, loginController);
  registerErrorHandler(app);

  return app;
};

describe('loginController', () => {
  it('responde 200 con el sobre del contrato y la sesion en data', async () => {
    loginServiceMock.mockResolvedValue(sessionResult);

    const response = await request(buildApp())
      .post(LOGIN_PATH)
      .send({ email: 'maria@estudioqp.pe', password: 'unaClaveLarga', remember_me: true });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.OK.code,
      message: HttpStatusCodes.OK.message,
      description: AuthMessages.login.success,
      path: LOGIN_PATH,
      data: sessionResult,
    });
    expect(response.body).not.toHaveProperty('meta');
  });

  it('normaliza el correo y aplica remember_me true por defecto antes de llamar al service', async () => {
    loginServiceMock.mockResolvedValue(sessionResult);

    await request(buildApp())
      .post(LOGIN_PATH)
      .set('User-Agent', 'Mozilla/5.0 (Macintosh)')
      .send({ email: '  Maria@EstudioQP.PE  ', password: 'unaClaveLarga' });

    expect(loginServiceMock).toHaveBeenCalledTimes(1);
    expect(loginServiceMock).toHaveBeenCalledWith({
      payload: { email: 'maria@estudioqp.pe', password: 'unaClaveLarga', remember_me: true },
      user_agent: 'Mozilla/5.0 (Macintosh)',
      ip_address: expect.any(String),
    });
  });

  it('propaga el 401 del service sin try/catch, con meta.code INVALID_CREDENTIALS', async () => {
    loginServiceMock.mockRejectedValue(
      new AppError(AuthMessages.login.invalid_credentials, HttpStatusCodes.UNAUTHORIZED.code, {
        code: ErrorCodes.INVALID_CREDENTIALS,
      }),
    );

    const response = await request(buildApp())
      .post(LOGIN_PATH)
      .send({ email: 'maria@estudioqp.pe', password: 'incorrecta' });
    const envelope = readErrorEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(envelope.meta).toEqual({ code: ErrorCodes.INVALID_CREDENTIALS });
    expect(envelope.description).toBe(AuthMessages.login.invalid_credentials);
  });

  it('propaga el 409 ACCOUNT_USES_GOOGLE del service', async () => {
    loginServiceMock.mockRejectedValue(
      new AppError(AuthMessages.login.account_uses_google, HttpStatusCodes.CONFLICT.code, {
        code: ErrorCodes.ACCOUNT_USES_GOOGLE,
      }),
    );

    const response = await request(buildApp())
      .post(LOGIN_PATH)
      .send({ email: 'maria@estudioqp.pe', password: 'unaClaveLarga' });
    const envelope = readErrorEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.CONFLICT.code);
    expect(envelope.meta).toEqual({ code: ErrorCodes.ACCOUNT_USES_GOOGLE });
    expect(envelope.description).toBe(AuthMessages.login.account_uses_google);
  });

  it('devuelve 422 VALIDATION_ERROR con meta.fields cuando Zod rechaza la entrada', async () => {
    const response = await request(buildApp())
      .post(LOGIN_PATH)
      .send({ email: 'no-es-un-correo', password: '' });
    const envelope = readErrorEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(envelope.meta).toEqual({
      code: ErrorCodes.VALIDATION_ERROR,
      fields: {
        email: 'auth.errors.email_invalid',
        password: 'errors.validation.required',
      },
    });
    expect(loginServiceMock).not.toHaveBeenCalled();
  });

  it('rechaza remember_me no booleano sin llegar al service', async () => {
    const response = await request(buildApp())
      .post(LOGIN_PATH)
      .send({ email: 'maria@estudioqp.pe', password: 'unaClaveLarga', remember_me: 'si' });
    const envelope = readErrorEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(envelope.meta.fields).toEqual({ remember_me: 'auth.errors.remember_me_invalid' });
    expect(loginServiceMock).not.toHaveBeenCalled();
  });
});
