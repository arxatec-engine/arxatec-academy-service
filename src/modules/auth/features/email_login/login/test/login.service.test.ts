import { ErrorCodes } from '@/constants/error_codes';
import { auth_provider, user_city, user_role } from '@/generated/enums';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { verifyPassword } from '@/infrastructure/password/hash_password';
import {
  findLoginCandidateByEmail,
  openLoginSession,
} from '@/modules/auth/features/email_login/login/data/login.repository';
import { DECOY_PASSWORD_HASH } from '@/modules/auth/features/email_login/login/domain/decoy_password_hash';
import { loginService } from '@/modules/auth/features/email_login/login/presentation/login.service';
import type { AuthUserWithPassword } from '@/modules/auth/shared/domain/auth_user.types';
import type { SessionRecord } from '@/modules/auth/shared/domain/session.types';
import { computeSessionAbsoluteExpiresAt } from '@/modules/auth/shared/policy/session_policy';
import { isAppError, type AppError } from '@/utils/errors';

jest.mock('@/modules/auth/features/email_login/login/data/login.repository', () => ({
  findLoginCandidateByEmail: jest.fn(),
  openLoginSession: jest.fn(),
}));

jest.mock('@/infrastructure/password/hash_password', () => ({
  verifyPassword: jest.fn(),
}));

jest.mock('@/infrastructure/jwt/sign_session_token', () => ({
  signSessionToken: jest.fn(),
}));

const findLoginCandidateByEmailMock = jest.mocked(findLoginCandidateByEmail);
const openLoginSessionMock = jest.mocked(openLoginSession);
const verifyPasswordMock = jest.mocked(verifyPassword);
const signSessionTokenMock = jest.mocked(signSessionToken);

const NOW = new Date('2026-08-20T12:00:00.000Z');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const passwordUser: AuthUserWithPassword = {
  id: 'usr_1',
  full_name: 'Maria Quispe Rojas',
  email: 'maria@estudioqp.pe',
  role: user_role.STUDENT,
  organization: 'Estudio Quispe & Rojas',
  is_independent: false,
  city: user_city.LIMA,
  city_other: null,
  avatar_key: null, avatar_url: null,
  email_verified_at: null,
  auth_provider: auth_provider.PASSWORD,
  created_at: new Date('2026-05-12T10:00:00.000Z'),
  password_hash: '$argon2id$v=19$m=65536,p=4,t=3$sal$hash-real',
};

const googleUser: AuthUserWithPassword = {
  ...passwordUser,
  id: 'usr_2',
  auth_provider: auth_provider.GOOGLE,
  password_hash: null,
};

const sessionRow = (expires_at: Date): SessionRecord => ({
  id: 'ses_1',
  user_id: passwordUser.id,
  remember_me: true,
  created_at: NOW,
  expires_at,
  last_used_at: NOW,
  revoked_at: null,
});

const input = (overrides: Partial<Parameters<typeof loginService>[0]> = {}) => ({
  payload: { email: passwordUser.email, password: 'unaClaveLarga', remember_me: true },
  user_agent: 'Mozilla/5.0 (Macintosh)',
  ip_address: '190.12.3.4',
  now: NOW,
  ...overrides,
});

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

describe('loginService', () => {
  beforeEach(() => {
    signSessionTokenMock.mockReturnValue('jwt.firmado');
  });

  describe('indistinguibilidad de credenciales', () => {
    it('responde 401 INVALID_CREDENTIALS cuando el correo no existe', async () => {
      findLoginCandidateByEmailMock.mockResolvedValue(null);
      verifyPasswordMock.mockResolvedValue(false);

      const error = await captureError(loginService(input()));

      expect(error.statusCode).toBe(401);
      expect(error.meta).toEqual({ code: ErrorCodes.INVALID_CREDENTIALS });
    });

    it('verifica igualmente la contrasena contra el hash senuelo cuando el correo no existe', async () => {
      findLoginCandidateByEmailMock.mockResolvedValue(null);
      verifyPasswordMock.mockResolvedValue(false);

      await captureError(loginService(input()));

      expect(verifyPasswordMock).toHaveBeenCalledTimes(1);
      expect(verifyPasswordMock).toHaveBeenCalledWith(DECOY_PASSWORD_HASH, 'unaClaveLarga');
    });

    it('devuelve exactamente la misma respuesta para correo inexistente y contrasena incorrecta', async () => {
      findLoginCandidateByEmailMock.mockResolvedValue(null);
      verifyPasswordMock.mockResolvedValue(false);
      const missing_email = await captureError(loginService(input()));

      findLoginCandidateByEmailMock.mockResolvedValue(passwordUser);
      verifyPasswordMock.mockResolvedValue(false);
      const wrong_password = await captureError(loginService(input()));

      expect(wrong_password.statusCode).toBe(missing_email.statusCode);
      expect(wrong_password.message).toBe(missing_email.message);
      expect(wrong_password.meta).toEqual(missing_email.meta);
    });

    it('no abre sesion en ninguno de los dos casos', async () => {
      findLoginCandidateByEmailMock.mockResolvedValue(null);
      verifyPasswordMock.mockResolvedValue(false);

      await captureError(loginService(input()));

      expect(openLoginSessionMock).not.toHaveBeenCalled();
      expect(signSessionTokenMock).not.toHaveBeenCalled();
    });
  });

  describe('cuenta creada con Google', () => {
    it('responde 409 ACCOUNT_USES_GOOGLE', async () => {
      findLoginCandidateByEmailMock.mockResolvedValue(googleUser);

      const error = await captureError(loginService(input()));

      expect(error.statusCode).toBe(409);
      expect(error.meta).toEqual({ code: ErrorCodes.ACCOUNT_USES_GOOGLE });
      expect(verifyPasswordMock).not.toHaveBeenCalled();
    });

    it('deja entrar con contrasena a una cuenta de Google que ya tiene hash', async () => {
      findLoginCandidateByEmailMock.mockResolvedValue({
        ...googleUser,
        password_hash: passwordUser.password_hash,
      });
      verifyPasswordMock.mockResolvedValue(true);
      openLoginSessionMock.mockResolvedValue(sessionRow(new Date(NOW.getTime() + THIRTY_DAYS_MS)));

      await expect(loginService(input())).resolves.toMatchObject({ token: 'jwt.firmado' });
    });
  });

  describe('sesion emitida', () => {
    it('caduca a los 30 dias con remember_me true', async () => {
      const expires_at = new Date(NOW.getTime() + THIRTY_DAYS_MS);
      findLoginCandidateByEmailMock.mockResolvedValue(passwordUser);
      verifyPasswordMock.mockResolvedValue(true);
      openLoginSessionMock.mockResolvedValue(sessionRow(expires_at));

      const result = await loginService(input());

      expect(openLoginSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ remember_me: true, expires_at }),
      );
      expect(result.expires_at).toBe(expires_at.toISOString());
    });

    it('caduca a las 12 horas con remember_me false', async () => {
      const expires_at = new Date(NOW.getTime() + TWELVE_HOURS_MS);
      findLoginCandidateByEmailMock.mockResolvedValue(passwordUser);
      verifyPasswordMock.mockResolvedValue(true);
      openLoginSessionMock.mockResolvedValue(sessionRow(expires_at));

      await loginService(
        input({
          payload: { email: passwordUser.email, password: 'unaClaveLarga', remember_me: false },
        }),
      );

      expect(openLoginSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ remember_me: false, expires_at }),
      );
    });

    it('guarda user_agent e ip en la sesion', async () => {
      findLoginCandidateByEmailMock.mockResolvedValue(passwordUser);
      verifyPasswordMock.mockResolvedValue(true);
      openLoginSessionMock.mockResolvedValue(sessionRow(new Date(NOW.getTime() + THIRTY_DAYS_MS)));

      await loginService(input());

      expect(openLoginSessionMock).toHaveBeenCalledWith({
        user_id: passwordUser.id,
        remember_me: true,
        expires_at: new Date(NOW.getTime() + THIRTY_DAYS_MS),
        user_agent: 'Mozilla/5.0 (Macintosh)',
        ip_address: '190.12.3.4',
      });
    });

    it('firma el JWT con el id de la sesion como jti y el tope absoluto de la sesion', async () => {
      const row_expires_at = new Date('2026-09-19T12:00:00.000Z');
      findLoginCandidateByEmailMock.mockResolvedValue(passwordUser);
      verifyPasswordMock.mockResolvedValue(true);
      openLoginSessionMock.mockResolvedValue(sessionRow(row_expires_at));

      const result = await loginService(input());

      expect(signSessionTokenMock).toHaveBeenCalledWith({
        user_id: passwordUser.id,
        session_id: 'ses_1',
        role: user_role.STUDENT,
        absolute_expires_at: computeSessionAbsoluteExpiresAt(NOW),
        issued_at: NOW,
      });
      expect(result.expires_at).toBe(row_expires_at.toISOString());
    });

    it('nunca deja salir password_hash en la respuesta', async () => {
      findLoginCandidateByEmailMock.mockResolvedValue(passwordUser);
      verifyPasswordMock.mockResolvedValue(true);
      openLoginSessionMock.mockResolvedValue(sessionRow(new Date(NOW.getTime() + THIRTY_DAYS_MS)));

      const result = await loginService(input());

      expect(Object.keys(result.user)).not.toContain('password_hash');
      expect(JSON.stringify(result)).not.toContain('hash-real');
    });

    it('devuelve el usuario del contrato con las fechas en ISO 8601', async () => {
      findLoginCandidateByEmailMock.mockResolvedValue(passwordUser);
      verifyPasswordMock.mockResolvedValue(true);
      openLoginSessionMock.mockResolvedValue(sessionRow(new Date(NOW.getTime() + THIRTY_DAYS_MS)));

      const result = await loginService(input());

      expect(result.user.id).toBe(passwordUser.id);
      expect(result.user.created_at).toBe('2026-05-12T10:00:00.000Z');
      expect(result.user.email_verified_at).toBeNull();
    });
  });
});
