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
import { AuthMessages } from '@/constants/messages/auth';
import { user_role } from '@/generated/enums';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { requireVerifiedEmail } from '@/middlewares/require_verified_email';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import type { SessionWithUser } from '@/modules/auth/shared/domain/session.types';

const findSessionByIdMock = jest.mocked(findSessionById);

const COMMENT_PATH = '/comments';

const now = new Date();

const sessionVerifiedAt = (email_verified_at: Date | null): SessionWithUser => ({
  id: 'ses_1',
  user_id: 'usr_1',
  remember_me: true,
  created_at: now,
  expires_at: new Date(now.getTime() + 60 * 60 * 1000),
  last_used_at: now,
  revoked_at: null,
  user: {
    id: 'usr_1',
    email: 'maria@estudioqp.pe',
    role: user_role.STUDENT,
    email_verified_at,
  },
});

const token = (): string =>
  signSessionToken({
    user_id: 'usr_1',
    session_id: 'ses_1',
    role: user_role.STUDENT,
    absolute_expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    issued_at: now,
  });

const buildApp = (): Express => {
  const app = express();

  app.post(COMMENT_PATH, authenticateTokenJwt, requireVerifiedEmail, (_req, res) => {
    res.status(HttpStatusCodes.CREATED.code).json({ ok: true });
  });
  registerErrorHandler(app);

  return app;
};

const call = async (bearer?: string) => {
  const pending = request(buildApp()).post(COMMENT_PATH);

  return bearer === undefined
    ? pending
    : pending.set(AuthHeaders.authorization, `${AuthHeaders.bearer_prefix}${bearer}`);
};

describe('requireVerifiedEmail', () => {
  it('deja pasar a quien ya verificó el correo', async () => {
    findSessionByIdMock.mockResolvedValue(sessionVerifiedAt(now));

    const response = await call(token());

    expect(response.status).toBe(HttpStatusCodes.CREATED.code);
  });

  it('corta con 403 EMAIL_NOT_VERIFIED y el sobre completo si no lo verificó', async () => {
    findSessionByIdMock.mockResolvedValue(sessionVerifiedAt(null));

    const response = await call(token());

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.FORBIDDEN.code,
      description: AuthMessages.email_verification.required,
      path: COMMENT_PATH,
      meta: { code: ErrorCodes.EMAIL_NOT_VERIFIED },
    });
  });

  it('sin sesión el 401 llega antes: este middleware va después de authenticateTokenJwt', async () => {
    const response = await call();

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.UNAUTHENTICATED } });
  });

  it('lee la verificación de la base, no del token: verificar y volver a pedirlo pasa', async () => {
    findSessionByIdMock.mockResolvedValue(sessionVerifiedAt(null));

    const before = await call(token());

    findSessionByIdMock.mockResolvedValue(sessionVerifiedAt(now));

    const after = await call(token());

    expect(before.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(after.status).toBe(HttpStatusCodes.CREATED.code);
  });
});
