import express, { type Express } from 'express';
import request from 'supertest';

import { ApiPrefix, AuthEndpoints, AuthRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { user_role } from '@/generated/enums';
import { authenticateRevocableSession } from '@/middlewares/authenticate_token_jwt';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { logoutRouter } from '@/modules/auth/features/session/logout/presentation/logout.routes';
import { logoutService } from '@/modules/auth/features/session/logout/presentation/logout.service';
import type { AuthenticatedUser } from '@/types/authenticated_user';

jest.mock('@/middlewares/authenticate_token_jwt', () => ({
  authenticateRevocableSession: jest.fn(),
}));

jest.mock('@/modules/auth/features/session/logout/presentation/logout.service', () => ({
  logoutService: jest.fn(),
}));

const authenticateSessionMock = jest.mocked(authenticateRevocableSession);
const logoutServiceMock = jest.mocked(logoutService);

const path = `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.logout}`;

const authenticated_user: AuthenticatedUser = {
  id: 'usr_1',
  email: 'maria@estudioqp.pe',
  role: user_role.STUDENT,
  session_id: 'ses_1',
  email_verified_at: null,
};

const buildApp = (user: AuthenticatedUser | undefined): Express => {
  authenticateSessionMock.mockImplementation((req, _res, next) => {
    if (user !== undefined) {
      req.user = user;
    }

    next();
  });

  const app = express();

  app.use(`${ApiPrefix}${AuthRoutePrefix}`, logoutRouter);
  registerErrorHandler(app);

  return app;
};

describe('POST /auth/logout', () => {
  it('responde 200 con el sobre del contrato y sin cuerpo de datos', async () => {
    logoutServiceMock.mockResolvedValue({ already_revoked: false });

    const response = await request(buildApp(authenticated_user)).post(path);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.OK.code,
      message: HttpStatusCodes.OK.message,
      description: AuthMessages.logout.success,
      path,
    });
    expect(response.body).not.toHaveProperty('data');
    expect(response.body).not.toHaveProperty('meta');
  });

  it('revoca la sesion del token, no una que mande el cliente en el cuerpo', async () => {
    logoutServiceMock.mockResolvedValue({ already_revoked: false });

    await request(buildApp(authenticated_user)).post(path).send({ session_id: 'ses_ajena' });

    expect(logoutServiceMock).toHaveBeenCalledTimes(1);
    expect(logoutServiceMock).toHaveBeenCalledWith({ session_id: 'ses_1' });
  });

  it('es idempotente: una sesion ya revocada responde 200, no error', async () => {
    logoutServiceMock.mockResolvedValue({ already_revoked: true });

    const response = await request(buildApp(authenticated_user)).post(path);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      description: AuthMessages.logout.already_revoked,
    });
  });

  it('responde 401 UNAUTHENTICATED si la peticion llega sin usuario de sesion', async () => {
    const response = await request(buildApp(undefined)).post(path);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({
      description: AuthMessages.session.unauthenticated,
      meta: { code: ErrorCodes.UNAUTHENTICATED },
    });
    expect(logoutServiceMock).not.toHaveBeenCalled();
  });

  it('monta el autenticador tolerante a sesion revocada delante del controller', async () => {
    logoutServiceMock.mockResolvedValue({ already_revoked: false });

    await request(buildApp(authenticated_user)).post(path);

    expect(authenticateSessionMock).toHaveBeenCalledTimes(1);
  });
});
