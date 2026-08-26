import { sign } from 'jsonwebtoken';

const JWT_SECRET = 'secreto-de-pruebas-con-mas-de-32-caracteres';
const JWT_ISSUER = 'arxatec-academy-test';

jest.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'secreto-de-pruebas-con-mas-de-32-caracteres',
    JWT_ISSUER: 'arxatec-academy-test',
  },
}));

import { ErrorCodes } from '@/constants/error_codes';
import { user_role } from '@/generated/enums';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { verifySessionToken } from '@/infrastructure/jwt/verify_session_token';
import { AppError, isAppError } from '@/utils/errors';

const issued_at = new Date('2026-08-20T12:00:00.000Z');
const absolute_expires_at = new Date('2027-02-16T12:00:00.000Z');

const validToken = (): string =>
  signSessionToken({
    user_id: 'usr_1',
    session_id: 'ses_1',
    role: user_role.STUDENT,
    absolute_expires_at,
    issued_at,
  });

const codeOf = (error: unknown): string | undefined =>
  isAppError(error) ? error.meta?.code : undefined;

describe('signSessionToken', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: issued_at });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('firma sub, jti, role, iss y exp tal como pide el contrato', () => {
    const payload = verifySessionToken(validToken());

    expect(payload).toMatchObject({
      sub: 'usr_1',
      jti: 'ses_1',
      role: user_role.STUDENT,
      iss: JWT_ISSUER,
      iat: Math.floor(issued_at.getTime() / 1000),
      exp: Math.floor(absolute_expires_at.getTime() / 1000),
    });
  });

  it('deriva exp de absolute_expires_at y no de un ttl propio', () => {
    const other_deadline = new Date(issued_at.getTime() + 12 * 60 * 60 * 1000);

    const token = signSessionToken({
      user_id: 'usr_1',
      session_id: 'ses_1',
      role: user_role.ADMIN,
      absolute_expires_at: other_deadline,
      issued_at,
    });

    expect(verifySessionToken(token).exp).toBe(Math.floor(other_deadline.getTime() / 1000));
  });

  it('el exp no es la caducidad deslizante de la fila: sobrevive a los 30 dias de inactividad', () => {
    const sliding_expires_at = new Date(issued_at.getTime() + 30 * 24 * 60 * 60 * 1000);

    expect(verifySessionToken(validToken()).exp).toBeGreaterThan(
      Math.floor(sliding_expires_at.getTime() / 1000),
    );
  });
});

describe('verifySessionToken', () => {
  it('distingue una sesion vencida con SESSION_EXPIRED', () => {
    const token = signSessionToken({
      user_id: 'usr_1',
      session_id: 'ses_1',
      role: user_role.STUDENT,
      absolute_expires_at: new Date(Date.now() - 1000),
      issued_at: new Date(Date.now() - 2000),
    });

    expect.assertions(3);

    try {
      verifySessionToken(token);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppError);
      expect(codeOf(error)).toBe(ErrorCodes.SESSION_EXPIRED);
      expect(isAppError(error) ? error.statusCode : 0).toBe(401);
    }
  });

  it('rechaza una firma manipulada con UNAUTHENTICATED', () => {
    const [header, payload] = validToken().split('.');
    const forged = `${header ?? ''}.${payload ?? ''}.firmafalsa`;

    expect(() => verifySessionToken(forged)).toThrow(AppError);

    try {
      verifySessionToken(forged);
    } catch (error: unknown) {
      expect(codeOf(error)).toBe(ErrorCodes.UNAUTHENTICATED);
    }
  });

  it('rechaza un token firmado por otro emisor', () => {
    const token = sign({ sub: 'usr_1', jti: 'ses_1', role: user_role.STUDENT }, JWT_SECRET, {
      algorithm: 'HS256',
      issuer: 'otro-emisor',
      expiresIn: 3600,
    });

    try {
      verifySessionToken(token);
      throw new Error('no lanzo');
    } catch (error: unknown) {
      expect(codeOf(error)).toBe(ErrorCodes.UNAUTHENTICATED);
    }
  });

  it('rechaza un token sin jti aunque la firma sea valida', () => {
    const token = sign({ sub: 'usr_1', role: user_role.STUDENT }, JWT_SECRET, {
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      expiresIn: 3600,
    });

    try {
      verifySessionToken(token);
      throw new Error('no lanzo');
    } catch (error: unknown) {
      expect(codeOf(error)).toBe(ErrorCodes.UNAUTHENTICATED);
    }
  });

  it('rechaza un token con un rol que no existe en el dominio', () => {
    const token = sign({ sub: 'usr_1', jti: 'ses_1', role: 'SUPERADMIN' }, JWT_SECRET, {
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      expiresIn: 3600,
    });

    try {
      verifySessionToken(token);
      throw new Error('no lanzo');
    } catch (error: unknown) {
      expect(codeOf(error)).toBe(ErrorCodes.UNAUTHENTICATED);
    }
  });

  it('rechaza un token firmado con otro secreto', () => {
    const token = sign({ sub: 'usr_1', jti: 'ses_1', role: user_role.STUDENT }, 'otro-secreto', {
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      expiresIn: 3600,
    });

    try {
      verifySessionToken(token);
      throw new Error('no lanzo');
    } catch (error: unknown) {
      expect(codeOf(error)).toBe(ErrorCodes.UNAUTHENTICATED);
    }
  });
});
