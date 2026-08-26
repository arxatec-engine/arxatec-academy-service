import { auth_provider, user_city, user_role } from '@/generated/enums';
import type { ApiUser, AuthUserRecord } from '@/modules/auth/shared/domain/auth_user.types';
import { toApiUser } from '@/modules/auth/shared/domain/user_mapper';
import { TEST_USER_ID } from '@/modules/user/shared/test/user_test_app';

export const userRecord = (overrides: Partial<AuthUserRecord> = {}): AuthUserRecord => ({
  id: TEST_USER_ID,
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
  ...overrides,
});

export const apiUser = (overrides: Partial<AuthUserRecord> = {}): ApiUser =>
  toApiUser(userRecord(overrides));

export const userRow = (overrides: Partial<AuthUserRecord> = {}) => ({
  ...userRecord(overrides),
  password_hash: '$argon2id$v=19$m=65536,t=3,p=4$sal$hash',
  avatar_key: null,
  updated_at: new Date('2026-05-12T10:00:00.000Z'),
});
