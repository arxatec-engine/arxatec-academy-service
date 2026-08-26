import type { auth_provider, user_city, user_role } from '@/generated/enums';

export interface AuthUserRecord {
  id: string;
  full_name: string;
  email: string;
  role: user_role;
  organization: string | null;
  is_independent: boolean;
  city: user_city;
  city_other: string | null;
  avatar_url: string | null;
  email_verified_at: Date | null;
  auth_provider: auth_provider;
  created_at: Date;
}

export interface AuthUserWithPassword extends AuthUserRecord {
  password_hash: string | null;
}

export interface ApiUser {
  id: string;
  full_name: string;
  email: string;
  role: user_role;
  organization: string | null;
  is_independent: boolean;
  city: user_city;
  city_other: string | null;
  avatar_url: string | null;
  email_verified_at: string | null;
  auth_provider: auth_provider;
  created_at: string;
}
