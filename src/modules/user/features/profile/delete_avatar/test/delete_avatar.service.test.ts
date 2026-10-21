import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { removeStoredFile } from '@/infrastructure/storage/cleanup';
import { deleteAvatarService } from '@/modules/user/features/profile/delete_avatar/presentation/delete_avatar.service';
import { findUserAvatar, setUserAvatar } from '@/modules/user/shared/data/user_account.repository';
import { userRecord } from '@/modules/user/shared/test/user_fixtures';

jest.mock('@/modules/user/shared/data/user_account.repository', () => ({
  findUserAvatar: jest.fn(),
  setUserAvatar: jest.fn(),
}));

jest.mock('@/infrastructure/storage/storage', () => ({
  storage: { save: jest.fn(), remove: jest.fn(), publicUrl: jest.fn() },
}));

jest.mock('@/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('@/infrastructure/storage/cleanup', () => ({ removeStoredFile: jest.fn() }));

const findAvatarMock = jest.mocked(findUserAvatar);
const setAvatarMock = jest.mocked(setUserAvatar);
const removeMock = jest.mocked(removeStoredFile);

beforeEach(() => {
  findAvatarMock.mockResolvedValue({ avatar_key: 'avatars/vieja.png' });
  setAvatarMock.mockResolvedValue(userRecord({ avatar_url: null }));
  removeMock.mockResolvedValue(undefined);
});

describe('deleteAvatarService', () => {
  it('deja la fila sin url y sin clave, y borra el archivo despues', async () => {
    const result = await deleteAvatarService({ user_id: 'usr_1' });

    expect(setAvatarMock).toHaveBeenCalledWith({
      user_id: 'usr_1',
      avatar_url: null,
      avatar_key: null,
    });
    expect(removeMock).toHaveBeenCalledWith('avatars/vieja.png');
    expect(removeMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      setAvatarMock.mock.invocationCallOrder[0] ?? 0,
    );
    expect(result.user.avatar_url).toBeNull();
  });

  it('quitar una foto que no existe no falla ni borra nada', async () => {
    findAvatarMock.mockResolvedValue({ avatar_key: null });

    await expect(deleteAvatarService({ user_id: 'usr_1' })).resolves.toMatchObject({
      user: { avatar_url: null },
    });
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('si el borrado del archivo falla, la fila ya quedo limpia y la peticion responde bien', async () => {
    removeMock.mockRejectedValue(new Error('el disco dice que no'));

    await expect(deleteAvatarService({ user_id: 'usr_1' })).resolves.toBeDefined();
    expect(setAvatarMock).toHaveBeenCalledTimes(1);
  });

  it('un usuario que ya no existe responde 404', async () => {
    findAvatarMock.mockResolvedValue(null);

    await expect(deleteAvatarService({ user_id: 'usr_1' })).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
    expect(setAvatarMock).not.toHaveBeenCalled();
  });
});
