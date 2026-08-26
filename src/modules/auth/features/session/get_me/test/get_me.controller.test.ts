import express, { type Express } from 'express';
import request from 'supertest';

import { ApiPrefix, AuthEndpoints, AuthRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { auth_provider, user_city, user_role } from '@/generated/enums';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { getMeRouter } from '@/modules/auth/features/session/get_me/presentation/get_me.routes';
import { getMeService } from '@/modules/auth/features/session/get_me/presentation/get_me.service';
import type { ApiUser } from '@/modules/auth/shared/domain/auth_user.types';
import type { AuthenticatedUser } from '@/types/authenticated_user';
import { AppError } from '@/utils/errors';

jest.mock('@/middlewares/authenticate_token_jwt', () => ({
  authenticateTokenJwt: jest.fn(),
}));

jest.mock('@/modules/auth/features/session/get_me/presentation/get_me.service', () => ({
  getMeService: jest.fn(),
}));

const authenticateTokenJwtMock = jest.mocked(authenticateTokenJwt);
const getMeServiceMock = jest.mocked(getMeService);

const path = `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.me}`;

const authenticated_user: AuthenticatedUser = {
  id: 'usr_1',
  email: 'maria@estudioqp.pe',
  role: user_role.STUDENT,
  session_id: 'ses_1',
  email_verified_at: null,
};

const api_user: ApiUser = {
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
};

const buildApp = (user: AuthenticatedUser | undefined): Express => {
  authenticateTokenJwtMock.mockImplementation((req, _res, next) => {
    if (user !== undefined) {
      req.user = user;
    }

    next();

    return Promise.resolve();
  });

  const app = express();

  app.use(`${ApiPrefix}${AuthRoutePrefix}`, getMeRouter);
  registerErrorHandler(app);

  return app;
};

describe('GET /auth/me', () => {
  it('responde 200 con el sobre del contrato y el usuario de la sesion', async () => {
    getMeServiceMock.mockResolvedValue({ user: api_user });

    const response = await request(buildApp(authenticated_user)).get(path);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.OK.code,
      message: HttpStatusCodes.OK.message,
      description: AuthMessages.me.success,
      path,
      data: { user: api_user },
    });
    expect(response.body).not.toHaveProperty('meta');
  });

  it('llama al service con el id del usuario autenticado, no con nada del cliente', async () => {
    getMeServiceMock.mockResolvedValue({ user: api_user });

    await request(buildApp(authenticated_user)).get(path).query({ user_id: 'usr_ajeno' });

    expect(getMeServiceMock).toHaveBeenCalledTimes(1);
    expect(getMeServiceMock).toHaveBeenCalledWith({ user_id: 'usr_1' });
  });

  it('no lleva try/catch: el AppError del service sale por el manejador global', async () => {
    getMeServiceMock.mockRejectedValue(
      new AppError(AuthMessages.user.not_found, HttpStatusCodes.NOT_FOUND.code, {
        code: ErrorCodes.NOT_FOUND,
      }),
    );

    const response = await request(buildApp(authenticated_user)).get(path);

    expect(response.status).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(response.body).toMatchObject({
      description: AuthMessages.user.not_found,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
  });

  it('responde 401 UNAUTHENTICATED si la peticion llega sin usuario de sesion', async () => {
    const response = await request(buildApp(undefined)).get(path);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({
      description: AuthMessages.session.unauthenticated,
      meta: { code: ErrorCodes.UNAUTHENTICATED },
    });
    expect(getMeServiceMock).not.toHaveBeenCalled();
  });

  it('monta authenticate_token_jwt delante del controller', async () => {
    getMeServiceMock.mockResolvedValue({ user: api_user });

    await request(buildApp(authenticated_user)).get(path);

    expect(authenticateTokenJwtMock).toHaveBeenCalledTimes(1);
  });
});
