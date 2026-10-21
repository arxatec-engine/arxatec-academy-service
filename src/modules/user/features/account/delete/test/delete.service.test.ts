import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { verifyPassword } from '@/infrastructure/password/hash_password';
import { removeStoredFile } from '@/infrastructure/storage/cleanup';
import { deleteAccountService } from '@/modules/user/features/account/delete/presentation/delete.service';
import {
  deleteUserAccount,
  findUserAvatar,
  findUserCredentialsById,
} from '@/modules/user/shared/data/user_account.repository';

jest.mock('@/modules/user/shared/data/user_account.repository', () => ({
  findUserCredentialsById: jest.fn(),
  findUserAvatar: jest.fn(),
  deleteUserAccount: jest.fn(),
}));

jest.mock('@/infrastructure/password/hash_password', () => ({ verifyPassword: jest.fn() }));

jest.mock('@/infrastructure/storage/storage', () => ({
  storage: { save: jest.fn(), remove: jest.fn(), publicUrl: jest.fn() },
}));

jest.mock('@/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('@/infrastructure/storage/cleanup', () => ({ removeStoredFile: jest.fn() }));

const findCredentialsMock = jest.mocked(findUserCredentialsById);
const findAvatarMock = jest.mocked(findUserAvatar);
const deleteAccountMock = jest.mocked(deleteUserAccount);
const verifyPasswordMock = jest.mocked(verifyPassword);
const removeMock = jest.mocked(removeStoredFile);

const PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$sal$hash';

beforeEach(() => {
  findCredentialsMock.mockResolvedValue({
    id: 'usr_1',
    email: 'maria@estudioqp.pe',
    password_hash: PASSWORD_HASH,
  });
  findAvatarMock.mockResolvedValue({ avatar_key: 'avatars/mia.png' });
  deleteAccountMock.mockResolvedValue(undefined);
  verifyPasswordMock.mockResolvedValue(true);
  removeMock.mockResolvedValue(undefined);
});

describe('deleteAccountService', () => {
  it('borra la cuenta cuando la contrasena es correcta', async () => {
    await deleteAccountService({ user_id: 'usr_1', password: 'claveActual' });

    expect(verifyPasswordMock).toHaveBeenCalledWith(PASSWORD_HASH, 'claveActual');
    expect(deleteAccountMock).toHaveBeenCalledWith('usr_1');
  });

  it('el avatar se borra FUERA de la transaccion y despues de ella', async () => {
    await deleteAccountService({ user_id: 'usr_1', password: 'claveActual' });

    expect(removeMock).toHaveBeenCalledWith('avatars/mia.png');
    expect(removeMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      deleteAccountMock.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('la clave del avatar se lee ANTES de borrar la fila, que es la que la guarda', async () => {
    await deleteAccountService({ user_id: 'usr_1', password: 'claveActual' });

    expect(findAvatarMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteAccountMock.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('sin contrasena en una cuenta que tiene contrasena responde 401 y no borra nada', async () => {
    await expect(deleteAccountService({ user_id: 'usr_1', password: null })).rejects.toMatchObject({
      statusCode: HttpStatusCodes.UNAUTHORIZED.code,
      message: UserMessages.account.password_required,
      meta: { code: ErrorCodes.INVALID_CREDENTIALS },
    });

    expect(deleteAccountMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('con la contrasena equivocada responde 401 y no borra nada', async () => {
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      deleteAccountService({ user_id: 'usr_1', password: 'noEsLaClave' }),
    ).rejects.toMatchObject({
      statusCode: HttpStatusCodes.UNAUTHORIZED.code,
      message: UserMessages.password.current_invalid,
      meta: { code: ErrorCodes.INVALID_CREDENTIALS },
    });

    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  it('una cuenta de Google se da de baja solo con la sesion', async () => {
    findCredentialsMock.mockResolvedValue({
      id: 'usr_1',
      email: 'maria@estudioqp.pe',
      password_hash: null,
    });

    await deleteAccountService({ user_id: 'usr_1', password: null });

    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(deleteAccountMock).toHaveBeenCalledWith('usr_1');
  });

  it('sin foto no se le pide nada al almacenamiento', async () => {
    findAvatarMock.mockResolvedValue({ avatar_key: null });

    await deleteAccountService({ user_id: 'usr_1', password: 'claveActual' });

    expect(removeMock).not.toHaveBeenCalled();
  });

  it('si el borrado del archivo falla, la cuenta sigue borrada y la peticion responde bien', async () => {
    removeMock.mockRejectedValue(new Error('el bucket dice que no'));

    await expect(
      deleteAccountService({ user_id: 'usr_1', password: 'claveActual' }),
    ).resolves.toBeUndefined();

    expect(deleteAccountMock).toHaveBeenCalledTimes(1);
  });

  it('un usuario que ya no existe responde 404', async () => {
    findCredentialsMock.mockResolvedValue(null);

    await expect(
      deleteAccountService({ user_id: 'usr_1', password: 'claveActual' }),
    ).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
  });
});
