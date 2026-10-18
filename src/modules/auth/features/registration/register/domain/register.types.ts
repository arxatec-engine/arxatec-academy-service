import type { RegisterPayload } from '@/modules/auth/features/registration/register/domain/register.payload';
import type { ApiSession } from '@/modules/auth/shared/domain/session.types';

export interface RegisterCommand extends RegisterPayload {
  user_agent: string | null;
  ip_address: string | null;
}

export interface RegisterResult extends ApiSession {
  verification_email_sent: boolean;
}
