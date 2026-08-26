import type { ApiUser, AuthUserRecord } from '@/modules/auth/shared/domain/auth_user.types';

export const toApiUser = (user: AuthUserRecord): ApiUser => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
  organization: user.organization,
  is_independent: user.is_independent,
  city: user.city,
  city_other: user.city_other,
  avatar_url: user.avatar_url,
  email_verified_at: user.email_verified_at === null ? null : user.email_verified_at.toISOString(),
  auth_provider: user.auth_provider,
  created_at: user.created_at.toISOString(),
});
