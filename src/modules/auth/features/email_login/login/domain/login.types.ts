import type { LoginPayload } from '@/modules/auth/features/email_login/login/domain/login.payload';
import type { ApiSession } from '@/modules/auth/shared/domain/session.types';

export interface LoginRequestContext {
  user_agent: string | null;
  ip_address: string | null;
}

export interface LoginInput extends LoginRequestContext {
  payload: LoginPayload;
  now?: Date;
}

export type LoginResult = ApiSession;
