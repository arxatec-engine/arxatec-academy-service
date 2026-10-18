jest.mock('@/config/prisma_client', () => {
  const client: Record<string, unknown> = {
    users: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };

  client['$transaction'] = jest.fn((run: (tx: unknown) => unknown) => run(client));

  return { prisma: client };
});

jest.mock('@/modules/auth/shared/data/auth_artifacts.repository', () => ({
  deleteUserAuthArtifacts: jest.fn(),
}));

jest.mock('@/modules/auth/shared/data/sessions.repository', () => ({
  revokeOtherUserSessions: jest.fn(),
}));

jest.mock('@/modules/comments/shared/data/comments.repository', () => ({
  deleteUserComments: jest.fn(),
}));

jest.mock('@/modules/progress/shared/data/progress.repository', () => ({
  deleteUserProgress: jest.fn(),
}));

import { prisma } from '@/config/prisma_client';
import { deleteUserAuthArtifacts } from '@/modules/auth/shared/data/auth_artifacts.repository';
import { revokeOtherUserSessions } from '@/modules/auth/shared/data/sessions.repository';
import { deleteUserComments } from '@/modules/comments/shared/data/comments.repository';
import { deleteUserProgress } from '@/modules/progress/shared/data/progress.repository';
import {
  changeUserPassword,
  deleteUserAccount,
  findUserAvatar,
  findUserCredentialsById,
  setUserAvatar,
  updateUserProfile,
} from '@/modules/user/shared/data/user_account.repository';
import { userRow } from '@/modules/user/shared/test/user_fixtures';

const usersFindUnique = jest.spyOn(prisma.users, 'findUnique');
const usersUpdate = jest.spyOn(prisma.users, 'update');
const usersDelete = jest.spyOn(prisma.users, 'delete');
const transaction = jest.spyOn(prisma, '$transaction');

const deleteProgressMock = jest.mocked(deleteUserProgress);
const deleteCommentsMock = jest.mocked(deleteUserComments);
const deleteAuthMock = jest.mocked(deleteUserAuthArtifacts);
const revokeOthersMock = jest.mocked(revokeOtherUserSessions);

const PROFILE_INPUT = {
  user_id: 'usr_1',
  full_name: 'Maria Quispe Rojas',
};

beforeEach(() => {
  usersFindUnique.mockResolvedValue(null);
  usersUpdate.mockResolvedValue(userRow());
  usersDelete.mockResolvedValue(userRow());
  revokeOthersMock.mockResolvedValue(3);
});

describe('el select del perfil', () => {
  it('nunca pide password_hash: la fuga se corta en la consulta', async () => {
    await updateUserProfile(PROFILE_INPUT);

    const select = usersUpdate.mock.calls[0]?.[0].select;

    expect(JSON.stringify(select)).not.toContain('password_hash');
    expect(JSON.stringify(select)).not.toContain('avatar_key');
    expect(Object.keys(select ?? {}).sort()).toEqual(
      [
        'auth_provider',
        'avatar_url',
        'city',
        'city_other',
        'created_at',
        'email',
        'email_verified_at',
        'full_name',
        'id',
        'is_independent',
        'organization',
        'role',
      ].sort(),
    );
  });

  it('actualiza solo el nombre, sin sobrescribir otros datos de la cuenta', async () => {
    await updateUserProfile(PROFILE_INPUT);

    expect(usersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'usr_1' },
        data: {
          full_name: 'Maria Quispe Rojas',
        },
      }),
    );
  });
});

describe('findUserCredentialsById', () => {
  it('trae el hash porque hay que compararlo, y nada mas que el correo y el id', async () => {
    await findUserCredentialsById('usr_1');

    expect(usersFindUnique).toHaveBeenCalledWith({
      where: { id: 'usr_1' },
      select: { id: true, email: true, password_hash: true },
    });
  });
});

describe('findUserAvatar / setUserAvatar', () => {
  it('lee solo la clave de almacenamiento', async () => {
    await findUserAvatar('usr_1');

    expect(usersFindUnique).toHaveBeenCalledWith({
      where: { id: 'usr_1' },
      select: { avatar_key: true },
    });
  });

  it('escribe url y clave a la vez: la url es para la API y la clave para borrar', async () => {
    await setUserAvatar({ user_id: 'usr_1', avatar_url: null, avatar_key: null });

    expect(usersUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { avatar_url: null, avatar_key: null } }),
    );
  });
});

describe('changeUserPassword', () => {
  it('guarda el hash y revoca las demas sesiones en la misma transaccion', async () => {
    const now = new Date('2026-08-21T12:00:00.000Z');

    const revoked = await changeUserPassword({
      user_id: 'usr_1',
      session_id: 'ses_1',
      password_hash: 'hash-nuevo',
      now,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(usersUpdate).toHaveBeenCalledWith({
      where: { id: 'usr_1' },
      data: { password_hash: 'hash-nuevo' },
      select: { id: true },
    });
    expect(revokeOthersMock).toHaveBeenCalledWith(
      { user_id: 'usr_1', except_session_id: 'ses_1', revoked_at: now },
      prisma,
    );
    expect(revoked).toBe(3);
  });
});

describe('deleteUserAccount', () => {
  it('borra en el orden del documento y la fila de users al final', async () => {
    await deleteUserAccount('usr_1');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(deleteProgressMock).toHaveBeenCalledWith('usr_1', prisma);
    expect(deleteCommentsMock).toHaveBeenCalledWith('usr_1', prisma);
    expect(deleteAuthMock).toHaveBeenCalledWith('usr_1', prisma);
    expect(usersDelete).toHaveBeenCalledWith({ where: { id: 'usr_1' }, select: { id: true } });

    const order = [
      deleteProgressMock.mock.invocationCallOrder[0] ?? 0,
      deleteCommentsMock.mock.invocationCallOrder[0] ?? 0,
      deleteAuthMock.mock.invocationCallOrder[0] ?? 0,
      usersDelete.mock.invocationCallOrder[0] ?? 0,
    ];

    expect(order).toEqual([...order].sort((left, right) => left - right));
  });

  it('todo va dentro de la transaccion: nadie recibe el cliente global por su cuenta', async () => {
    await deleteUserAccount('usr_1');

    for (const call of [
      deleteProgressMock.mock.calls[0],
      deleteCommentsMock.mock.calls[0],
      deleteAuthMock.mock.calls[0],
    ]) {
      expect(call?.[1]).toBeDefined();
    }
  });
});
