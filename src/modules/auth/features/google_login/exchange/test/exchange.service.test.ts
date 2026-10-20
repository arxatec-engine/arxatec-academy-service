import { AuthTokenTtlSeconds } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { auth_provider, user_city, user_role } from '@/generated/enums';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { hashOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  consumeOauthExchangeToken,
  findOauthExchangeToken,
} from '@/modules/auth/features/google_login/exchange/data/exchange.repository';
import { exchangeGoogleCode } from '@/modules/auth/features/google_login/exchange/presentation/exchange.service';
import { createSession } from '@/modules/auth/shared/data/sessions.repository';
import { computeSessionAbsoluteExpiresAt } from '@/modules/auth/shared/policy/session_policy';
import { findUserById } from '@/modules/auth/shared/data/users.repository';
import type { AuthUserRecord } from '@/modules/auth/shared/domain/auth_user.types';
import type { SessionRecord } from '@/modules/auth/shared/domain/session.types';
import { isAppError, type AppError } from '@/utils/errors';

jest.mock('@/modules/auth/features/google_login/exchange/data/exchange.repository', () => ({
  consumeOauthExchangeToken: jest.fn(),
  findOauthExchangeToken: jest.fn(),
}));

jest.mock('@/modules/auth/shared/data/sessions.repository', () => ({ createSession: jest.fn() }));

jest.mock('@/modules/auth/shared/data/users.repository', () => ({ findUserById: jest.fn() }));

jest.mock('@/infrastructure/jwt/sign_session_token', () => ({ signSessionToken: jest.fn() }));

const findTokenMock = jest.mocked(findOauthExchangeToken);
const consumeTokenMock = jest.mocked(consumeOauthExchangeToken);
const createSessionMock = jest.mocked(createSession);
const findUserByIdMock = jest.mocked(findUserById);
const signSessionTokenMock = jest.mocked(signSessionToken);

const NOW = new Date('2026-08-20T12:00:00.000Z');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const CODE = 'codigo-opaco-de-un-solo-uso';

const usableToken = {
  id: 'tok_1',
  user_id: 'usr_1',
  expires_at: new Date(NOW.getTime() + AuthTokenTtlSeconds.oauth_exchange_code * 1000),
  consumed_at: null,
};

const googleUser: AuthUserRecord = {
  id: 'usr_1',
  full_name: 'Maria Quispe Rojas',
  email: 'maria@estudioqp.pe',
  role: user_role.STUDENT,
  organization: null,
  is_independent: false,
  city: user_city.OTHER,
  city_other: null,
  avatar_key: null, avatar_url: 'https://lh3.googleusercontent.com/a/foto',
  email_verified_at: NOW,
  auth_provider: auth_provider.GOOGLE,
  created_at: new Date('2026-05-12T10:00:00.000Z'),
};

const session: SessionRecord = {
  id: 'ses_1',
  user_id: googleUser.id,
  remember_me: true,
  created_at: NOW,
  expires_at: new Date(NOW.getTime() + THIRTY_DAYS_MS),
  last_used_at: NOW,
  revoked_at: null,
};

const captureError = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) {
      return error;
    }

    throw error;
  }

  throw new Error('Se esperaba un AppError y la promesa se resolvio');
};

const run = () =>
  exchangeGoogleCode({
    code: CODE,
    user_agent: 'Mozilla/5.0 (Macintosh)',
    ip_address: '190.12.3.4',
    now: NOW,
  });

describe('exchangeGoogleCode', () => {
  beforeEach(() => {
    consumeTokenMock.mockResolvedValue(1);
    findUserByIdMock.mockResolvedValue(googleUser);
    createSessionMock.mockResolvedValue(session);
    signSessionTokenMock.mockReturnValue('jwt.firmado');
  });

  describe('canje correcto', () => {
    beforeEach(() => {
      findTokenMock.mockResolvedValue(usableToken);
    });

    it('busca el codigo por su hash, nunca por el codigo en claro', async () => {
      await run();

      expect(findTokenMock).toHaveBeenCalledWith(hashOneTimeToken(CODE));
      expect(findTokenMock).not.toHaveBeenCalledWith(CODE);
    });

    it('consume el codigo antes de abrir la sesion', async () => {
      await run();

      expect(consumeTokenMock).toHaveBeenCalledWith('tok_1', NOW);
      expect(consumeTokenMock.mock.invocationCallOrder[0]).toBeLessThan(
        createSessionMock.mock.invocationCallOrder[0],
      );
    });

    it('abre una sesion de 30 dias con el user_agent y la ip de la peticion', async () => {
      await run();

      expect(createSessionMock).toHaveBeenCalledWith({
        user_id: googleUser.id,
        remember_me: true,
        expires_at: new Date(NOW.getTime() + THIRTY_DAYS_MS),
        user_agent: 'Mozilla/5.0 (Macintosh)',
        ip_address: '190.12.3.4',
      });
    });

    it('firma el JWT con el id de la sesion como jti y el tope absoluto de la sesion', async () => {
      const result = await run();

      expect(signSessionTokenMock).toHaveBeenCalledWith({
        user_id: googleUser.id,
        session_id: session.id,
        role: user_role.STUDENT,
        absolute_expires_at: computeSessionAbsoluteExpiresAt(session.created_at),
        issued_at: NOW,
      });
      expect(result.token).toBe('jwt.firmado');
      expect(result.expires_at).toBe(session.expires_at.toISOString());
    });

    it('devuelve el usuario del contrato, sin password_hash y con fechas ISO 8601', async () => {
      const result = await run();

      expect(Object.keys(result.user)).not.toContain('password_hash');
      expect(result.user.created_at).toBe('2026-05-12T10:00:00.000Z');
      expect(result.user.auth_provider).toBe(auth_provider.GOOGLE);
    });
  });

  describe('codigos que no sirven', () => {
    it('rechaza un codigo inexistente con 400 TOKEN_INVALID', async () => {
      findTokenMock.mockResolvedValue(null);

      const error = await captureError(run());

      expect(error.statusCode).toBe(HttpStatusCodes.BAD_REQUEST.code);
      expect(error.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
      expect(consumeTokenMock).not.toHaveBeenCalled();
      expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('rechaza un codigo vencido sin consumirlo', async () => {
      findTokenMock.mockResolvedValue({ ...usableToken, expires_at: NOW });

      const error = await captureError(run());

      expect(error.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
      expect(consumeTokenMock).not.toHaveBeenCalled();
    });

    it('rechaza un codigo ya usado', async () => {
      findTokenMock.mockResolvedValue({ ...usableToken, consumed_at: NOW });

      const error = await captureError(run());

      expect(error.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
      expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('rechaza la segunda peticion de una carrera: si el UPDATE no toca ninguna fila, no hay sesion', async () => {
      findTokenMock.mockResolvedValue(usableToken);
      consumeTokenMock.mockResolvedValue(0);

      const error = await captureError(run());

      expect(error.statusCode).toBe(HttpStatusCodes.BAD_REQUEST.code);
      expect(error.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
      expect(createSessionMock).not.toHaveBeenCalled();
      expect(signSessionTokenMock).not.toHaveBeenCalled();
    });

    it('responde 404 NOT_FOUND si el usuario del codigo ya no existe', async () => {
      findTokenMock.mockResolvedValue(usableToken);
      findUserByIdMock.mockResolvedValue(null);

      const error = await captureError(run());

      expect(error.statusCode).toBe(HttpStatusCodes.NOT_FOUND.code);
      expect(error.meta).toEqual({ code: ErrorCodes.NOT_FOUND });
      expect(createSessionMock).not.toHaveBeenCalled();
    });
  });
});
