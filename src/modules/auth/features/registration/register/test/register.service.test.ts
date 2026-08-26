import { logger } from '@/config/logger';
import { AuthTokenTtlSeconds } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { auth_provider, user_city, user_role } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';
import { buildVerificationEmail } from '@/infrastructure/email/templates/verification_email';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { hashPassword } from '@/infrastructure/password/hash_password';
import { createOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  createEmailVerificationToken,
  isEmailRegistered,
} from '@/modules/auth/features/registration/register/data/register.repository';
import type { RegisterCommand } from '@/modules/auth/features/registration/register/domain/register.types';
import { registerUser } from '@/modules/auth/features/registration/register/presentation/register.service';
import { createSession } from '@/modules/auth/shared/data/sessions.repository';
import { createUser } from '@/modules/auth/shared/data/users.repository';
import type { AuthUserRecord } from '@/modules/auth/shared/domain/auth_user.types';
import type { SessionRecord } from '@/modules/auth/shared/domain/session.types';
import { computeSessionAbsoluteExpiresAt } from '@/modules/auth/shared/policy/session_policy';
import { isAppError, type AppError } from '@/utils/errors';

jest.mock('@/modules/auth/features/registration/register/data/register.repository', () => ({
  isEmailRegistered: jest.fn(),
  createEmailVerificationToken: jest.fn(),
}));

jest.mock('@/modules/auth/shared/data/users.repository', () => ({
  createUser: jest.fn(),
}));

jest.mock('@/modules/auth/shared/data/sessions.repository', () => ({
  createSession: jest.fn(),
}));

jest.mock('@/infrastructure/password/hash_password', () => ({
  hashPassword: jest.fn(),
}));

jest.mock('@/infrastructure/jwt/sign_session_token', () => ({
  signSessionToken: jest.fn(),
}));

jest.mock('@/infrastructure/tokens/one_time_token', () => ({
  createOneTimeToken: jest.fn(),
}));

jest.mock('@/infrastructure/email/send_email', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@/infrastructure/email/templates/verification_email', () => ({
  buildVerificationEmail: jest.fn(),
}));

jest.mock('@/config/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const isEmailRegisteredMock = jest.mocked(isEmailRegistered);
const createEmailVerificationTokenMock = jest.mocked(createEmailVerificationToken);
const createUserMock = jest.mocked(createUser);
const createSessionMock = jest.mocked(createSession);
const hashPasswordMock = jest.mocked(hashPassword);
const signSessionTokenMock = jest.mocked(signSessionToken);
const createOneTimeTokenMock = jest.mocked(createOneTimeToken);
const sendEmailMock = jest.mocked(sendEmail);
const buildVerificationEmailMock = jest.mocked(buildVerificationEmail);
const loggerErrorMock = jest.mocked(logger.error);

const NOW = new Date('2026-08-20T12:00:00.000Z');
const THIRTY_DAYS_LATER = new Date('2026-09-19T12:00:00.000Z');
const PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$sal$hash';
const SESSION_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.firmado';

const user: AuthUserRecord = {
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
  created_at: NOW,
};

const session: SessionRecord = {
  id: 'ses_1',
  user_id: user.id,
  remember_me: true,
  created_at: NOW,
  expires_at: THIRTY_DAYS_LATER,
  last_used_at: NOW,
  revoked_at: null,
};

const buildCommand = (overrides: Partial<RegisterCommand> = {}): RegisterCommand => ({
  full_name: 'Maria Quispe Rojas',
  email: 'maria@estudioqp.pe',
  password: 'unaClaveLarga',
  organization: 'Estudio Quispe & Rojas',
  is_independent: false,
  city: user_city.LIMA,
  city_other: null,
  user_agent: 'jest',
  ip_address: '127.0.0.1',
  ...overrides,
});

const readAppError = async (promise: Promise<unknown>): Promise<AppError> => {
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

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });

  isEmailRegisteredMock.mockResolvedValue(false);
  createUserMock.mockResolvedValue(user);
  createSessionMock.mockResolvedValue(session);
  hashPasswordMock.mockResolvedValue(PASSWORD_HASH);
  signSessionTokenMock.mockReturnValue(SESSION_TOKEN);
  createOneTimeTokenMock.mockReturnValue({
    token: 'token-en-claro',
    token_hash: 'a'.repeat(64),
    expires_at: new Date('2026-08-21T12:00:00.000Z'),
  });
  createEmailVerificationTokenMock.mockResolvedValue({
    id: 'tok_1',
    expires_at: new Date('2026-08-21T12:00:00.000Z'),
  });
  buildVerificationEmailMock.mockReturnValue({
    subject: 'Verifica tu correo',
    html: '<p>enlace</p>',
    text: 'enlace',
  });
  sendEmailMock.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('registerUser', () => {
  it('devuelve la sesion del contrato con el usuario ya mapeado', async () => {
    const result = await registerUser(buildCommand());

    expect(result).toEqual({
      token: SESSION_TOKEN,
      expires_at: THIRTY_DAYS_LATER.toISOString(),
      user: expect.objectContaining({ id: user.id, email: user.email }),
    });
  });

  it('nunca deja salir el hash de la contrasena en la respuesta', async () => {
    const result = await registerUser(buildCommand());

    expect(Object.keys(result.user)).not.toContain('password_hash');
    expect(JSON.stringify(result)).not.toContain(PASSWORD_HASH);
    expect(JSON.stringify(result)).not.toContain('unaClaveLarga');
  });

  it('abre la sesion con remember_me true y 30 dias de inactividad tolerada', async () => {
    await registerUser(buildCommand());

    expect(createSessionMock).toHaveBeenCalledWith({
      user_id: user.id,
      remember_me: true,
      expires_at: THIRTY_DAYS_LATER,
      user_agent: 'jest',
      ip_address: '127.0.0.1',
    });
  });

  it('guarda la contrasena solo hasheada y con el proveedor PASSWORD', async () => {
    await registerUser(buildCommand());

    expect(hashPasswordMock).toHaveBeenCalledWith('unaClaveLarga');
    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        password_hash: PASSWORD_HASH,
        auth_provider: auth_provider.PASSWORD,
      }),
    );
  });

  it('no deja que el registro elija el rol', async () => {
    await registerUser(buildCommand());

    expect(createUserMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ role: expect.anything() }),
    );
  });

  it('fuerza organization null cuando is_independent es true', async () => {
    await registerUser(buildCommand({ is_independent: true }));

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ organization: null, is_independent: true }),
    );
  });

  it('descarta city_other cuando la ciudad no es OTHER', async () => {
    await registerUser(buildCommand({ city: user_city.LIMA, city_other: 'Cusco' }));

    expect(createUserMock).toHaveBeenCalledWith(expect.objectContaining({ city_other: null }));
  });

  it('conserva city_other cuando la ciudad es OTHER', async () => {
    await registerUser(buildCommand({ city: user_city.OTHER, city_other: 'Cusco' }));

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ city: user_city.OTHER, city_other: 'Cusco' }),
    );
  });

  it('responde 409 EMAIL_ALREADY_REGISTERED y no crea nada si el correo ya existe', async () => {
    isEmailRegisteredMock.mockResolvedValue(true);

    const error = await readAppError(registerUser(buildCommand()));

    expect(error.statusCode).toBe(HttpStatusCodes.CONFLICT.code);
    expect(error.meta?.code).toBe(ErrorCodes.EMAIL_ALREADY_REGISTERED);
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(createUserMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('traduce la colision del indice unico a 409 EMAIL_ALREADY_REGISTERED', async () => {
    createUserMock.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    const error = await readAppError(registerUser(buildCommand()));

    expect(error.statusCode).toBe(HttpStatusCodes.CONFLICT.code);
    expect(error.meta?.code).toBe(ErrorCodes.EMAIL_ALREADY_REGISTERED);
  });

  it('deja subir cualquier otro fallo de la base de datos', async () => {
    createUserMock.mockRejectedValue(new Error('la base de datos se cayo'));

    await expect(registerUser(buildCommand())).rejects.toThrow('la base de datos se cayo');
  });

  it('guarda solo el hash del token de verificacion, con 24 h de vida', async () => {
    await registerUser(buildCommand());

    expect(createOneTimeTokenMock).toHaveBeenCalledWith(AuthTokenTtlSeconds.email_verification);
    expect(createEmailVerificationTokenMock).toHaveBeenCalledWith({
      user_id: user.id,
      token_hash: 'a'.repeat(64),
      expires_at: new Date('2026-08-21T12:00:00.000Z'),
    });
    expect(JSON.stringify(createEmailVerificationTokenMock.mock.calls)).not.toContain(
      'token-en-claro',
    );
  });

  it('manda el correo de verificacion al correo de la cuenta', async () => {
    await registerUser(buildCommand());

    expect(buildVerificationEmailMock).toHaveBeenCalledWith({ token: 'token-en-claro' });
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: user.email,
      subject: 'Verifica tu correo',
      html: '<p>enlace</p>',
      text: 'enlace',
    });
  });

  it('crea la cuenta y devuelve sesion aunque el envio del correo falle (D-002)', async () => {
    sendEmailMock.mockRejectedValue(new Error('smtp caido'));

    const result = await registerUser(buildCommand());

    expect(result.token).toBe(SESSION_TOKEN);
    expect(createUserMock).toHaveBeenCalledTimes(1);
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
  });

  it('crea la cuenta y devuelve sesion aunque falle guardar el token de verificacion', async () => {
    createEmailVerificationTokenMock.mockRejectedValue(new Error('insert fallido'));

    const result = await registerUser(buildCommand());

    expect(result.token).toBe(SESSION_TOKEN);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
  });

  it('firma el JWT contra la sesion guardada, no contra una fecha calculada aparte', async () => {
    await registerUser(buildCommand());

    expect(signSessionTokenMock).toHaveBeenCalledWith({
      user_id: user.id,
      session_id: session.id,
      role: user.role,
      absolute_expires_at: computeSessionAbsoluteExpiresAt(session.created_at),
    });
  });
});
