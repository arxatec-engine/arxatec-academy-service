import express, { type Express } from 'express';
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

import { AuthHeaders } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { user_role } from '@/generated/enums';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { optionalAuthenticate } from '@/middlewares/optional_authenticate';
import { findSessionById, touchSession } from '@/modules/auth/shared/data/sessions.repository';
import type { SessionWithUser } from '@/modules/auth/shared/domain/session.types';

const findSessionByIdMock = jest.mocked(findSessionById);
const touchSessionMock = jest.mocked(touchSession);

const PUBLIC_PATH = '/api/v1/courses/fundamentos-de-legal-tech';
const PRIVATE_PATH = '/api/v1/auth/me';

const NOW = new Date();
const HOUR_MS = 60 * 60 * 1000;

const session = (overrides: Partial<SessionWithUser> = {}): SessionWithUser => ({
  id: 'ses_1',
  user_id: 'usr_1',
  remember_me: true,
  created_at: new Date(NOW.getTime() - HOUR_MS),
  expires_at: new Date(NOW.getTime() + HOUR_MS),
  last_used_at: NOW,
  revoked_at: null,
  user: {
    id: 'usr_1',
    email: 'maria@estudioqp.pe',
    role: user_role.STUDENT,
    email_verified_at: NOW,
  },
  ...overrides,
});

const tokenExpiringAt = (absolute_expires_at: Date): string =>
  signSessionToken({
    user_id: 'usr_1',
    session_id: 'ses_1',
    role: user_role.STUDENT,
    absolute_expires_at,
    issued_at: new Date(NOW.getTime() - 2 * HOUR_MS),
  });

const validToken = (): string => tokenExpiringAt(new Date(NOW.getTime() + 24 * HOUR_MS));
const expiredToken = (): string => tokenExpiringAt(new Date(NOW.getTime() - HOUR_MS));

const buildApp = (): Express => {
  const app = express();

  app.get(PUBLIC_PATH, optionalAuthenticate, (req, res) => {
    res
      .status(HttpStatusCodes.OK.code)
      .json({ anonymous: req.user === undefined, user_id: req.user?.id ?? null });
  });
  app.get(PRIVATE_PATH, authenticateTokenJwt, (req, res) => {
    res.status(HttpStatusCodes.OK.code).json({ user_id: req.user?.id ?? null });
  });
  registerErrorHandler(app);

  return app;
};

const callPublic = (token?: string) => {
  const pending = request(buildApp()).get(PUBLIC_PATH);

  return token === undefined
    ? pending
    : pending.set(AuthHeaders.authorization, `${AuthHeaders.bearer_prefix}${token}`);
};

beforeEach(() => {
  jest.clearAllMocks();
  findSessionByIdMock.mockResolvedValue(session());
});

describe('optionalAuthenticate · deja pasar', () => {
  it('sin cabecera Authorization sigue como anónimo', async () => {
    const response = await callPublic();

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toEqual({ anonymous: true, user_id: null });
    expect(findSessionByIdMock).not.toHaveBeenCalled();
  });

  it('con una cabecera que no es Bearer sigue como anónimo', async () => {
    const response = await request(buildApp())
      .get(PUBLIC_PATH)
      .set(AuthHeaders.authorization, 'Basic dXNlcjpwYXNz');

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toEqual({ anonymous: true, user_id: null });
  });

  it('con un Bearer vacío sigue como anónimo', async () => {
    const response = await callPublic('   ');

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toEqual({ anonymous: true, user_id: null });
  });

  it('con un token ilegible sigue como anónimo y no consulta la sesión', async () => {
    const response = await callPublic('esto.no.es-un-jwt');

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toEqual({ anonymous: true, user_id: null });
    expect(findSessionByIdMock).not.toHaveBeenCalled();
  });

  it('con un token caducado responde 200 anónimo, no 401 SESSION_EXPIRED', async () => {
    const response = await callPublic(expiredToken());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toEqual({ anonymous: true, user_id: null });
  });

  it('el mismo token caducado sí corta en una ruta autenticada', async () => {
    const response = await request(buildApp())
      .get(PRIVATE_PATH)
      .set(AuthHeaders.authorization, `${AuthHeaders.bearer_prefix}${expiredToken()}`);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.SESSION_EXPIRED } });
  });
});

describe('optionalAuthenticate · no desbloquea de más', () => {
  it('un token válido de una sesión revocada sigue como anónimo', async () => {
    findSessionByIdMock.mockResolvedValue(session({ revoked_at: NOW }));

    const response = await callPublic(validToken());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toEqual({ anonymous: true, user_id: null });
  });

  it('un token válido de una sesión vencida en base de datos sigue como anónimo', async () => {
    findSessionByIdMock.mockResolvedValue(session({ expires_at: new Date(NOW.getTime() - 1000) }));

    const response = await callPublic(validToken());

    expect(response.body).toEqual({ anonymous: true, user_id: null });
  });

  it('un token cuyo sub no es el dueño de la sesión sigue como anónimo', async () => {
    findSessionByIdMock.mockResolvedValue(session({ user_id: 'usr_otro' }));

    const response = await callPublic(validToken());

    expect(response.body).toEqual({ anonymous: true, user_id: null });
  });

  it('una sesión que ya no existe sigue como anónimo', async () => {
    findSessionByIdMock.mockResolvedValue(null);

    const response = await callPublic(validToken());

    expect(response.body).toEqual({ anonymous: true, user_id: null });
  });
});

describe('optionalAuthenticate · con sesión viva', () => {
  it('adjunta el usuario de la sesión', async () => {
    const response = await callPublic(validToken());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toEqual({ anonymous: false, user_id: 'usr_1' });
    expect(findSessionByIdMock).toHaveBeenCalledWith('ses_1');
  });

  it('no renueva la sesión: una ruta pública no escribe en base de datos', async () => {
    findSessionByIdMock.mockResolvedValue(
      session({ last_used_at: new Date(NOW.getTime() - HOUR_MS) }),
    );

    await callPublic(validToken());

    expect(touchSessionMock).not.toHaveBeenCalled();
  });

  it('un fallo de base de datos no se traga: sale por el manejador global', async () => {
    findSessionByIdMock.mockRejectedValue(new Error('conexion caida'));

    const response = await callPublic(validToken());

    expect(response.status).toBe(HttpStatusCodes.INTERNAL_SERVER_ERROR.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.INTERNAL_ERROR } });
  });
});
