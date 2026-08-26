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
import { CommonMessages } from '@/constants/messages/common';
import { user_role } from '@/generated/enums';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { requireAdmin } from '@/middlewares/require_admin';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import type { SessionWithUser } from '@/modules/auth/shared/domain/session.types';

const findSessionByIdMock = jest.mocked(findSessionById);

const ADMIN_PATH = '/admin/courses';

const now = new Date();

const sessionWithRole = (role: user_role): SessionWithUser => ({
  id: 'ses_1',
  user_id: 'usr_1',
  remember_me: true,
  created_at: now,
  expires_at: new Date(now.getTime() + 60 * 60 * 1000),
  last_used_at: now,
  revoked_at: null,
  user: { id: 'usr_1', email: 'admin@arxatec.pe', role, email_verified_at: now },
});

const tokenSignedAs = (role: user_role): string =>
  signSessionToken({
    user_id: 'usr_1',
    session_id: 'ses_1',
    role,
    absolute_expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    issued_at: now,
  });

const buildApp = (): Express => {
  const app = express();

  app.get(ADMIN_PATH, authenticateTokenJwt, requireAdmin, (_req, res) => {
    res.status(HttpStatusCodes.OK.code).json({ ok: true });
  });
  registerErrorHandler(app);

  return app;
};

const call = async (token: string) =>
  request(buildApp())
    .get(ADMIN_PATH)
    .set(AuthHeaders.authorization, `${AuthHeaders.bearer_prefix}${token}`);

describe('requireAdmin', () => {
  it('deja pasar a un ADMIN', async () => {
    findSessionByIdMock.mockResolvedValue(sessionWithRole(user_role.ADMIN));

    const response = await call(tokenSignedAs(user_role.ADMIN));

    expect(response.status).toBe(HttpStatusCodes.OK.code);
  });

  it('corta a un alumno con 403 FORBIDDEN y el sobre completo', async () => {
    findSessionByIdMock.mockResolvedValue(sessionWithRole(user_role.STUDENT));

    const response = await call(tokenSignedAs(user_role.STUDENT));

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.FORBIDDEN.code,
      message: HttpStatusCodes.FORBIDDEN.message,
      description: CommonMessages.forbidden,
      path: ADMIN_PATH,
      meta: { code: ErrorCodes.FORBIDDEN },
    });
  });

  it('rol revocado en base de datos con un JWT que todavia dice ADMIN: 403', async () => {
    findSessionByIdMock.mockResolvedValue(sessionWithRole(user_role.STUDENT));

    const response = await call(tokenSignedAs(user_role.ADMIN));

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.FORBIDDEN } });
    expect(findSessionByIdMock).toHaveBeenCalledWith('ses_1');
  });
});
