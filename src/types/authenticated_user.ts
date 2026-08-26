import type { user_role } from '@/generated/enums';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: user_role;
  session_id: string;
  email_verified_at: Date | null;
}
