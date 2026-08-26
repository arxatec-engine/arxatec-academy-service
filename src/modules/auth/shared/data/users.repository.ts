import { prisma } from '@/config/prisma_client';
import type { auth_provider, user_city, user_role } from '@/generated/enums';
import type {
  AuthUserRecord,
  AuthUserWithPassword,
} from '@/modules/auth/shared/domain/auth_user.types';
import { normalizeEmail } from '@/modules/auth/shared/domain/normalize_email';

const AUTH_USER_SELECT = {
  id: true,
  full_name: true,
  email: true,
  role: true,
  organization: true,
  is_independent: true,
  city: true,
  city_other: true,
  avatar_url: true,
  email_verified_at: true,
  auth_provider: true,
  created_at: true,
} as const;

const AUTH_USER_WITH_PASSWORD_SELECT = {
  ...AUTH_USER_SELECT,
  password_hash: true,
} as const;

export interface CreateUserInput {
  full_name: string;
  email: string;
  password_hash: string | null;
  role?: user_role;
  organization: string | null;
  is_independent: boolean;
  city: user_city;
  city_other: string | null;
  avatar_url?: string | null;
  email_verified_at?: Date | null;
  auth_provider: auth_provider;
}

export const findUserByEmail = async (email: string): Promise<AuthUserWithPassword | null> =>
  prisma.users.findUnique({
    where: { email: normalizeEmail(email) },
    select: AUTH_USER_WITH_PASSWORD_SELECT,
  });

export const findUserById = async (id: string): Promise<AuthUserRecord | null> =>
  prisma.users.findUnique({ where: { id }, select: AUTH_USER_SELECT });

export const createUser = async (input: CreateUserInput): Promise<AuthUserRecord> =>
  prisma.users.create({
    data: {
      full_name: input.full_name,
      email: normalizeEmail(input.email),
      password_hash: input.password_hash,
      role: input.role,
      organization: input.organization,
      is_independent: input.is_independent,
      city: input.city,
      city_other: input.city_other,
      avatar_url: input.avatar_url ?? null,
      email_verified_at: input.email_verified_at ?? null,
      auth_provider: input.auth_provider,
    },
    select: AUTH_USER_SELECT,
  });
