import { ErrorCodes } from '@/constants/error_codes';
import { FileMaxSizeBytes, FileUsages, MimeTypes, StorageKeyPrefix } from '@/constants/files';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { storage } from '@/infrastructure/storage/storage';
import { updateAvatarService } from '@/modules/user/features/profile/update_avatar/presentation/update_avatar.service';
import { findUserAvatar, setUserAvatar } from '@/modules/user/shared/data/user_account.repository';
import { userRecord } from '@/modules/user/shared/test/user_fixtures';

jest.mock('@/modules/user/shared/data/user_account.repository', () => ({
  findUserAvatar: jest.fn(),
  setUserAvatar: jest.fn(),
}));

jest.mock('@/infrastructure/storage/storage', () => ({
  storage: { save: jest.fn(), remove: jest.fn(), publicUrl: jest.fn(), readUrl: jest.fn() },
}));

jest.mock('@/config/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const findAvatarMock = jest.mocked(findUserAvatar);
const setAvatarMock = jest.mocked(setUserAvatar);
const saveMock = jest.spyOn(storage, 'save');
const removeMock = jest.spyOn(storage, 'remove');
const readUrlMock = jest.spyOn(storage, 'readUrl');

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 0x41),
]);
const GIF = Buffer.from('GIF89a-una-imagen-animada', 'latin1');

const STORED_URL = 'http://localhost:3001/files/avatars/nueva.png';

const command = (overrides: Record<string, unknown> = {}) => ({
  user_id: 'usr_1',
  mime_type: MimeTypes.png,
  size_bytes: PNG.byteLength,
  content: PNG,
  ...overrides,
});

beforeEach(() => {
  findAvatarMock.mockResolvedValue({ avatar_key: 'avatars/vieja.png' });
  setAvatarMock.mockResolvedValue(userRecord({ avatar_url: STORED_URL, avatar_key: 'avatars/nueva.png' }));
  readUrlMock.mockReturnValue(STORED_URL);
  saveMock.mockResolvedValue({
    key: 'avatars/nueva.png',
    url: STORED_URL,
    mime_type: MimeTypes.png,
    size_bytes: PNG.byteLength,
  });
  removeMock.mockResolvedValue(undefined);
});

describe('updateAvatarService', () => {
  it('devuelve una lectura temporal y persiste solamente la URL canónica', async () => {
    readUrlMock.mockReturnValue('https://cdn.test/avatars/nueva.png?Signature=temporary');
    const result = await updateAvatarService(command());
    expect(setAvatarMock).toHaveBeenCalledWith(expect.objectContaining({ avatar_url: STORED_URL }));
    expect(readUrlMock).toHaveBeenCalledWith('avatars/nueva.png');
    expect(result.user.avatar_url).toContain('Signature=temporary');
    expect(result.user).not.toHaveProperty('avatar_key');
  });

  it('guarda el archivo con una clave del prefijo de avatares y escribe url y clave', async () => {
    const result = await updateAvatarService(command());

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ content: PNG, mime_type: MimeTypes.png }),
    );
    expect(saveMock.mock.calls[0]?.[0].key).toMatch(
      new RegExp(`^${StorageKeyPrefix[FileUsages.avatar]}/[0-9a-f-]+\\.png$`),
    );
    expect(setAvatarMock).toHaveBeenCalledWith({
      user_id: 'usr_1',
      avatar_url: STORED_URL,
      avatar_key: 'avatars/nueva.png',
    });
    expect(result.user.avatar_url).toBe(STORED_URL);
  });

  it('borra la foto anterior DESPUES de guardar la nueva y de escribir la fila', async () => {
    await updateAvatarService(command());

    expect(removeMock).toHaveBeenCalledWith('avatars/vieja.png');
    expect(removeMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      saveMock.mock.invocationCallOrder[0] ?? 0,
    );
    expect(removeMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      setAvatarMock.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('sin foto anterior no intenta borrar nada', async () => {
    findAvatarMock.mockResolvedValue({ avatar_key: null });

    await updateAvatarService(command());

    expect(removeMock).not.toHaveBeenCalled();
  });

  it('si el borrado de la anterior falla, la peticion sigue siendo un exito', async () => {
    removeMock.mockRejectedValue(new Error('el disco dice que no'));

    await expect(updateAvatarService(command())).resolves.toMatchObject({
      user: { avatar_url: STORED_URL },
    });
  });

  it('un GIF responde 415 INVALID_FILE_TYPE y no toca ni el almacenamiento ni la fila', async () => {
    await expect(
      updateAvatarService(command({ mime_type: 'image/gif', size_bytes: GIF.byteLength, content: GIF })),
    ).rejects.toMatchObject({
      statusCode: HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE.code,
      meta: { code: ErrorCodes.INVALID_FILE_TYPE },
    });

    expect(saveMock).not.toHaveBeenCalled();
    expect(setAvatarMock).not.toHaveBeenCalled();
  });

  it('un PNG que dice ser JPEG responde 415: el mime del cliente no se cree', async () => {
    await expect(
      updateAvatarService(command({ mime_type: MimeTypes.jpeg })),
    ).rejects.toMatchObject({
      statusCode: HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE.code,
      meta: { code: ErrorCodes.INVALID_FILE_TYPE },
    });
  });

  it('2 MB exactos pasan y un byte mas responde 413', async () => {
    const limit = FileMaxSizeBytes[FileUsages.avatar];

    await expect(updateAvatarService(command({ size_bytes: limit }))).resolves.toBeDefined();

    await expect(updateAvatarService(command({ size_bytes: limit + 1 }))).rejects.toMatchObject({
      statusCode: HttpStatusCodes.PAYLOAD_TOO_LARGE.code,
      meta: { code: ErrorCodes.FILE_TOO_LARGE },
    });
  });

  it('un usuario que ya no existe responde 404 antes de guardar el archivo', async () => {
    findAvatarMock.mockResolvedValue(null);

    await expect(updateAvatarService(command())).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
      meta: { code: ErrorCodes.NOT_FOUND },
    });

    expect(saveMock).not.toHaveBeenCalled();
  });
});
