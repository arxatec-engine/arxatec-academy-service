import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { sendEmail } from '@/infrastructure/email/send_email';
import { hashPassword, verifyPassword } from '@/infrastructure/password/hash_password';
import { updatePasswordService } from '@/modules/user/features/profile/update_password/presentation/update_password.service';
import {
  changeUserPassword,
  findUserCredentialsById,
} from '@/modules/user/shared/data/user_account.repository';

jest.mock('@/modules/user/shared/data/user_account.repository', () => ({
  findUserCredentialsById: jest.fn(),
  changeUserPassword: jest.fn(),
}));

jest.mock('@/infrastructure/password/hash_password', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

jest.mock('@/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const findCredentialsMock = jest.mocked(findUserCredentialsById);
const changePasswordMock = jest.mocked(changeUserPassword);
const hashPasswordMock = jest.mocked(hashPassword);
const verifyPasswordMock = jest.mocked(verifyPassword);
const sendEmailMock = jest.mocked(sendEmail);

const CURRENT_HASH = '$argon2id$v=19$m=65536,t=3,p=4$sal$hash';
const NEW_HASH = '$argon2id$v=19$m=65536,t=3,p=4$sal$nuevo';

const payload = {
  user_id: 'usr_1',
  session_id: 'ses_1',
  current_password: 'claveActual',
  new_password: 'claveNuevaLarga',
};

beforeEach(() => {
  findCredentialsMock.mockResolvedValue({
    id: 'usr_1',
    email: 'maria@estudioqp.pe',
    password_hash: CURRENT_HASH,
  });
  verifyPasswordMock.mockResolvedValue(true);
  hashPasswordMock.mockResolvedValue(NEW_HASH);
  changePasswordMock.mockResolvedValue(2);
  sendEmailMock.mockResolvedValue(undefined);
});

describe('updatePasswordService', () => {
  it('guarda el hash nuevo conservando la sesion que hizo el cambio', async () => {
    const result = await updatePasswordService(payload);

    expect(verifyPasswordMock).toHaveBeenCalledWith(CURRENT_HASH, 'claveActual');
    expect(hashPasswordMock).toHaveBeenCalledWith('claveNuevaLarga');
    expect(changePasswordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'usr_1',
        session_id: 'ses_1',
        password_hash: NEW_HASH,
      }),
    );
    expect(result.revoked_sessions).toBe(2);
  });

  it('manda el aviso al correo de la cuenta', async () => {
    await updatePasswordService(payload);

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'maria@estudioqp.pe' }),
    );
  });

  it('la contrasena actual incorrecta responde 401 INVALID_CREDENTIALS y no escribe nada', async () => {
    verifyPasswordMock.mockResolvedValue(false);

    await expect(updatePasswordService(payload)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.UNAUTHORIZED.code,
      message: UserMessages.password.current_invalid,
      meta: { code: ErrorCodes.INVALID_CREDENTIALS },
    });

    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(changePasswordMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('una cuenta de Google sin hash responde 409 ACCOUNT_USES_GOOGLE sin comprobar nada mas', async () => {
    findCredentialsMock.mockResolvedValue({
      id: 'usr_1',
      email: 'maria@estudioqp.pe',
      password_hash: null,
    });

    await expect(updatePasswordService(payload)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.CONFLICT.code,
      meta: { code: ErrorCodes.ACCOUNT_USES_GOOGLE },
    });

    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('un usuario que ya no existe responde 404', async () => {
    findCredentialsMock.mockResolvedValue(null);

    await expect(updatePasswordService(payload)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
  });

  it('si el correo de aviso falla, el cambio ya hecho no se deshace', async () => {
    sendEmailMock.mockRejectedValue(new Error('smtp caido'));

    await expect(updatePasswordService(payload)).resolves.toEqual({ revoked_sessions: 2 });
    expect(changePasswordMock).toHaveBeenCalledTimes(1);
  });
});
