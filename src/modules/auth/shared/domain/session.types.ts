import type { user_role } from '@/generated/enums';
import type { ApiUser } from '@/modules/auth/shared/domain/auth_user.types';

export interface SessionRecord {
  id: string;
  user_id: string;
  remember_me: boolean;
  created_at: Date;
  expires_at: Date;
  last_used_at: Date;
  revoked_at: Date | null;
}

export interface SessionUser {
  id: string;
  email: string;
  role: user_role;
  email_verified_at: Date | null;
}

export interface SessionWithUser extends SessionRecord {
  user: SessionUser;
}

export interface ApiSession {
  token: string;
  expires_at: string;
  user: ApiUser;
}
