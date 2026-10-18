import express, { type Express } from 'express';
import request from 'supertest';

import { AuthRateLimits } from '@/constants/auth';
import { ApiPrefix, AuthEndpoints, AuthRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { ValidationKeys } from '@/constants/validation_keys';
import { auth_provider, user_city, user_role } from '@/generated/enums';
import { registerErrorHandler } from '@/middlewares/error_handler';
import type { RegisterResult } from '@/modules/auth/features/registration/register/domain/register.types';
import { registerController } from '@/modules/auth/features/registration/register/presentation/register.controller';
import { registerRouter } from '@/modules/auth/features/registration/register/presentation/register.routes';
import { registerUser } from '@/modules/auth/features/registration/register/presentation/register.service';
import { AppError } from '@/utils/errors';

jest.mock('@/modules/auth/features/registration/register/presentation/register.service', () => ({
  registerUser: jest.fn(),
}));

jest.mock('@/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const registerUserMock = jest.mocked(registerUser);

const ROUTE = `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.register}`;

const session: RegisterResult = {
  token: 'eyJhbGciOiJIUzI1NiJ9.firmado',
  verification_email_sent: true,
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
    created_at: '2026-08-20T12:00:00.000Z',
  },
};

const baseBody = {
  full_name: 'Maria Quispe Rojas',
  email: 'maria@estudioqp.pe',
  password: 'unaClaveLarga',
  organization: 'Estudio Quispe & Rojas',
  city: user_city.LIMA,
  city_other: null,
};

const validBody = { ...baseBody, is_independent: false };

const buildApp = (): Express => {
  const app = express();

  app.use(express.json());
  app.post(ROUTE, registerController);
  registerErrorHandler(app);

  return app;
};

const buildRoutedApp = (): Express => {
  const app = express();

  app.use(express.json());
  app.use(`${ApiPrefix}${AuthRoutePrefix}`, registerRouter);
  registerErrorHandler(app);

  return app;
};

beforeEach(() => {
  registerUserMock.mockResolvedValue(session);
});

describe('POST /auth/register', () => {
  it('permite crear una cuenta solo con nombre, correo y contrasena', async () => {
    const response = await request(buildApp()).post(ROUTE).send({
      full_name: baseBody.full_name,
      email: baseBody.email,
      password: baseBody.password,
    });

    expect(response.status).toBe(HttpStatusCodes.CREATED.code);
    expect(registerUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: baseBody.full_name,
        email: baseBody.email,
        password: baseBody.password,
        is_independent: false,
        city: user_city.OTHER,
      }),
    );
    const command = registerUserMock.mock.calls[0]?.[0];
    expect(command?.organization).toBeUndefined();
    expect(command?.city_other).toBeUndefined();
  });

  it('responde 201 con el sobre del contrato y la sesion en data', async () => {
    const response = await request(buildApp()).post(ROUTE).send(validBody);

    const body: unknown = response.body;

    expect(response.status).toBe(HttpStatusCodes.CREATED.code);
    expect(body).toMatchObject({
      status: HttpStatusCodes.CREATED.code,
      message: HttpStatusCodes.CREATED.message,
      description: AuthMessages.register.created,
      path: ROUTE,
      data: session,
    });
  });

  it('normaliza el correo a minusculas y sin espacios antes de llamar al service', async () => {
    await request(buildApp())
      .post(ROUTE)
      .send({ ...validBody, email: '  MARIA@EstudioQP.pe  ' });

    expect(registerUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'maria@estudioqp.pe' }),
    );
  });

  it('descarta los campos que el registro no puede elegir', async () => {
    await request(buildApp())
      .post(ROUTE)
      .send({ ...validBody, role: user_role.ADMIN, email_verified_at: '2026-08-20T12:00:00.000Z' });

    expect(registerUserMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ role: expect.anything() }),
    );
    expect(registerUserMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ email_verified_at: expect.anything() }),
    );
  });

  it('aplica is_independent false por defecto cuando no viene', async () => {
    await request(buildApp()).post(ROUTE).send(baseBody);

    expect(registerUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ is_independent: false }),
    );
  });

  it('responde 422 con la clave i18n del campo cuando la contrasena es corta', async () => {
    const response = await request(buildApp())
      .post(ROUTE)
      .send({ ...validBody, password: 'corta12' });

    const body: unknown = response.body;

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(body).toMatchObject({
      meta: {
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { password: ValidationKeys.auth.password_too_short },
      },
    });
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it('responde 422 cuando la ciudad es OTHER y falta city_other', async () => {
    const response = await request(buildApp())
      .post(ROUTE)
      .send({ ...validBody, city: user_city.OTHER, city_other: null });

    const body: unknown = response.body;

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(body).toMatchObject({
      meta: {
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { city_other: ValidationKeys.auth.city_other_required },
      },
    });
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it('no acepta una ciudad OTHER con city_other en blanco', async () => {
    const response = await request(buildApp())
      .post(ROUTE)
      .send({ ...validBody, city: user_city.OTHER, city_other: '   ' });

    const body: unknown = response.body;

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(body).toMatchObject({
      meta: { fields: { city_other: ValidationKeys.auth.city_other_required } },
    });
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it('responde 422 con la clave del correo cuando el correo no es valido', async () => {
    const response = await request(buildApp())
      .post(ROUTE)
      .send({ ...validBody, email: 'maria(arroba)estudioqp.pe' });

    const body: unknown = response.body;

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(body).toMatchObject({
      meta: { fields: { email: ValidationKeys.auth.email_invalid } },
    });
  });

  it('responde 409 EMAIL_ALREADY_REGISTERED cuando el service lo lanza', async () => {
    registerUserMock.mockRejectedValue(
      new AppError(AuthMessages.register.email_already_registered, HttpStatusCodes.CONFLICT.code, {
        code: ErrorCodes.EMAIL_ALREADY_REGISTERED,
      }),
    );

    const response = await request(buildApp()).post(ROUTE).send(validBody);

    const body: unknown = response.body;

    expect(response.status).toBe(HttpStatusCodes.CONFLICT.code);
    expect(body).toMatchObject({
      description: AuthMessages.register.email_already_registered,
      meta: { code: ErrorCodes.EMAIL_ALREADY_REGISTERED },
    });
  });

  it('nunca devuelve la contrasena ni su hash en la respuesta', async () => {
    const response = await request(buildApp()).post(ROUTE).send(validBody);

    expect(response.text).not.toContain('unaClaveLarga');
    expect(response.text).not.toContain('password_hash');
  });

  it('corta con 429 RATE_LIMITED al pasarse del limite por IP del contrato', async () => {
    const app = buildRoutedApp();

    for (let attempt = 0; attempt < AuthRateLimits.register.max; attempt += 1) {
      const allowed = await request(app).post(ROUTE).send(validBody);

      expect(allowed.status).toBe(HttpStatusCodes.CREATED.code);
    }

    const blocked = await request(app).post(ROUTE).send(validBody);

    const body: unknown = blocked.body;

    expect(blocked.status).toBe(HttpStatusCodes.TOO_MANY_REQUESTS.code);
    expect(body).toMatchObject({ meta: { code: ErrorCodes.RATE_LIMITED } });
    expect(blocked.headers['retry-after']).toBe(String(AuthRateLimits.register.window_seconds));
  });
});
