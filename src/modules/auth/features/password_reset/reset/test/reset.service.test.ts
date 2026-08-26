import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { sendEmail } from '@/infrastructure/email/send_email';
import { hashPassword } from '@/infrastructure/password/hash_password';
import { hashOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  consumePasswordReset,
  findPasswordResetToken,
} from '@/modules/auth/features/password_reset/reset/data/reset.repository';
import type { PasswordResetTokenRecord } from '@/modules/auth/features/password_reset/reset/domain/reset.types';
import { resetPassword } from '@/modules/auth/features/password_reset/reset/presentation/reset.service';
import { AppError } from '@/utils/errors';

jest.mock('@/modules/auth/features/password_reset/reset/data/reset.repository', () => ({
  findPasswordResetToken: jest.fn(),
  consumePasswordReset: jest.fn(),
}));

jest.mock('@/infrastructure/password/hash_password', () => ({
  hashPassword: jest.fn(),
}));

jest.mock('@/infrastructure/email/send_email', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const findTokenMock = jest.mocked(findPasswordResetToken);
const consumeMock = jest.mocked(consumePasswordReset);
const hashPasswordMock = jest.mocked(hashPassword);
const sendEmailMock = jest.mocked(sendEmail);

const PLAIN_TOKEN = 'un-token-del-enlace';
const NEW_PASSWORD = 'unaClaveLarga';
const PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$sal$hash';

const buildToken = (
  overrides: Partial<PasswordResetTokenRecord> = {},
): PasswordResetTokenRecord => ({
  id: 'tok_1',
  user_id: 'usr_1',
  expires_at: new Date(Date.now() + 60 * 60 * 1000),
  consumed_at: null,
  user: { id: 'usr_1', email: 'maria@estudioqp.pe', email_verified_at: null },
  ...overrides,
});

const payload = { token: PLAIN_TOKEN, password: NEW_PASSWORD };

const expectTokenInvalid = async (promise: Promise<void>): Promise<void> => {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({
    statusCode: HttpStatusCodes.BAD_REQUEST.code,
    meta: { code: ErrorCodes.TOKEN_INVALID },
  });
};

beforeEach(() => {
  hashPasswordMock.mockResolvedValue(PASSWORD_HASH);
  consumeMock.mockResolvedValue({ consumed: true, revoked_sessions: 3 });
  sendEmailMock.mockResolvedValue(undefined);
});

describe('resetPassword', () => {
  it('busca el token por su hash SHA-256 y nunca por el valor en claro', async () => {
    findTokenMock.mockResolvedValue(buildToken());

    await resetPassword(payload);

    expect(findTokenMock).toHaveBeenCalledWith(hashOneTimeToken(PLAIN_TOKEN));
    expect(findTokenMock).not.toHaveBeenCalledWith(PLAIN_TOKEN);
  });

  it('consume el token, guarda el hash nuevo y avisa por correo', async () => {
    findTokenMock.mockResolvedValue(buildToken());

    await resetPassword(payload);

    expect(hashPasswordMock).toHaveBeenCalledWith(NEW_PASSWORD);
    expect(consumeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token_id: 'tok_1',
        user_id: 'usr_1',
        password_hash: PASSWORD_HASH,
      }),
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'maria@estudioqp.pe' }),
    );
  });

  it('marca el correo como verificado cuando no lo estaba', async () => {
    findTokenMock.mockResolvedValue(buildToken());

    await resetPassword(payload);

    expect(consumeMock).toHaveBeenCalledWith(
      expect.objectContaining({ mark_email_verified: true }),
    );
  });

  it('no toca email_verified_at cuando el correo ya estaba verificado', async () => {
    findTokenMock.mockResolvedValue(
      buildToken({
        user: {
          id: 'usr_1',
          email: 'maria@estudioqp.pe',
          email_verified_at: new Date('2026-05-12T10:00:00.000Z'),
        },
      }),
    );

    await resetPassword(payload);

    expect(consumeMock).toHaveBeenCalledWith(
      expect.objectContaining({ mark_email_verified: false }),
    );
  });

  it('rechaza con TOKEN_INVALID un token inexistente', async () => {
    findTokenMock.mockResolvedValue(null);

    await expectTokenInvalid(resetPassword(payload));

    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(consumeMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('rechaza con TOKEN_INVALID un token caducado', async () => {
    findTokenMock.mockResolvedValue(buildToken({ expires_at: new Date(Date.now() - 1000) }));

    await expectTokenInvalid(resetPassword(payload));

    expect(consumeMock).not.toHaveBeenCalled();
  });

  it('rechaza con TOKEN_INVALID un token ya consumido', async () => {
    findTokenMock.mockResolvedValue(buildToken({ consumed_at: new Date(Date.now() - 1000) }));

    await expectTokenInvalid(resetPassword(payload));

    expect(consumeMock).not.toHaveBeenCalled();
  });

  it('rechaza con TOKEN_INVALID cuando otra peticion gano la carrera por el mismo token', async () => {
    findTokenMock.mockResolvedValue(buildToken());
    consumeMock.mockResolvedValue({ consumed: false, revoked_sessions: 0 });

    await expectTokenInvalid(resetPassword(payload));

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('no deshace el cambio si falla el correo de aviso', async () => {
    findTokenMock.mockResolvedValue(buildToken());
    sendEmailMock.mockRejectedValue(new Error('smtp caido'));

    await expect(resetPassword(payload)).resolves.toBeUndefined();

    expect(consumeMock).toHaveBeenCalledTimes(1);
  });
});
