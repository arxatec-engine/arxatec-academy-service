import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { auth_provider, user_city, user_role } from '@/generated/enums';
import { storage } from '@/infrastructure/storage/storage';
import { findSessionUser } from '@/modules/auth/features/session/get_me/data/get_me.repository';
import { getMeService } from '@/modules/auth/features/session/get_me/presentation/get_me.service';
import type { AuthUserRecord } from '@/modules/auth/shared/domain/auth_user.types';
import { AppError, isAppError } from '@/utils/errors';

jest.mock('@/modules/auth/features/session/get_me/data/get_me.repository', () => ({
  findSessionUser: jest.fn(),
}));

const findSessionUserMock = jest.mocked(findSessionUser);

const user: AuthUserRecord = {
  id: 'usr_1',
  full_name: 'Maria Quispe Rojas',
  email: 'maria@estudioqp.pe',
  role: user_role.STUDENT,
  organization: 'Estudio Quispe & Rojas',
  is_independent: false,
  city: user_city.LIMA,
  city_other: null,
  avatar_key: null, avatar_url: null,
  email_verified_at: new Date('2026-05-13T10:00:00.000Z'),
  auth_provider: auth_provider.PASSWORD,
  created_at: new Date('2026-05-12T10:00:00.000Z'),
};

describe('getMeService', () => {
  it('renueva el avatar desde su clave sin exponerla al cliente', async () => {
    findSessionUserMock.mockResolvedValue({ ...user,
      avatar_url: 'https://old.test/photo.png', avatar_key: 'avatars/uuid.png' });
    const readUrl = jest.spyOn(storage, 'readUrl').mockReturnValue('https://cdn.test/new?Signature=one');
    const result = await getMeService({ user_id: user.id });
    expect(readUrl).toHaveBeenCalledWith('avatars/uuid.png');
    expect(result.user.avatar_url).toBe('https://cdn.test/new?Signature=one');
    expect(result.user).not.toHaveProperty('avatar_key');
  });

  it('consulta el usuario por el id que viene en el payload', async () => {
    findSessionUserMock.mockResolvedValue(user);

    await getMeService({ user_id: 'usr_1' });

    expect(findSessionUserMock).toHaveBeenCalledTimes(1);
    expect(findSessionUserMock).toHaveBeenCalledWith('usr_1');
  });

  it('devuelve el usuario con la forma del contrato y las fechas en ISO 8601', async () => {
    findSessionUserMock.mockResolvedValue(user);

    const result = await getMeService({ user_id: 'usr_1' });

    expect(result.user.id).toBe('usr_1');
    expect(result.user.email).toBe('maria@estudioqp.pe');
    expect(result.user.role).toBe(user_role.STUDENT);
    expect(result.user.created_at).toBe('2026-05-12T10:00:00.000Z');
    expect(result.user.email_verified_at).toBe('2026-05-13T10:00:00.000Z');
  });

  it('nunca deja salir password_hash', async () => {
    findSessionUserMock.mockResolvedValue(user);

    const result = await getMeService({ user_id: 'usr_1' });

    expect(Object.keys(result.user)).not.toContain('password_hash');
    expect(Object.keys(result)).toEqual(['user']);
  });

  it('lanza 404 NOT_FOUND cuando la sesion apunta a un usuario que ya no existe', async () => {
    findSessionUserMock.mockResolvedValue(null);

    await expect(getMeService({ user_id: 'usr_borrado' })).rejects.toBeInstanceOf(AppError);

    findSessionUserMock.mockResolvedValue(null);

    const error: unknown = await getMeService({ user_id: 'usr_borrado' }).catch(
      (reason: unknown) => reason,
    );

    if (!isAppError(error)) {
      throw new Error('se esperaba un AppError');
    }

    expect(error.statusCode).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(error.meta?.code).toBe(ErrorCodes.NOT_FOUND);
    expect(error.message).toBe(AuthMessages.user.not_found);
  });
});
