import { auth_provider, user_city, user_role } from '@/generated/enums';
import type { AuthUserWithPassword } from '@/modules/auth/shared/domain/auth_user.types';
import { toApiUser } from '@/modules/auth/shared/domain/user_mapper';

const user: AuthUserWithPassword = {
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
  created_at: new Date('2026-05-12T10:00:00.000Z'),
  password_hash: '$argon2id$v=19$m=65536,t=3,p=4$sal$hash',
};

describe('toApiUser', () => {
  it('devuelve exactamente los campos del contrato', () => {
    expect(Object.keys(toApiUser(user)).sort()).toEqual(
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

  it('nunca deja salir password_hash', () => {
    const api_user = toApiUser(user);

    expect(Object.keys(api_user)).not.toContain('password_hash');
    expect(JSON.stringify(api_user)).not.toContain('argon2id');
  });

  it('serializa las fechas en ISO 8601', () => {
    expect(toApiUser(user).created_at).toBe('2026-05-12T10:00:00.000Z');
    expect(
      toApiUser({ ...user, email_verified_at: new Date('2026-05-13T10:00:00.000Z') })
        .email_verified_at,
    ).toBe('2026-05-13T10:00:00.000Z');
  });

  it('mantiene null en email_verified_at cuando el correo no se verifico', () => {
    expect(toApiUser(user).email_verified_at).toBeNull();
  });
});
