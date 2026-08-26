import {
  createSession,
  type CreateSessionInput,
} from '@/modules/auth/shared/data/sessions.repository';
import { findUserByEmail } from '@/modules/auth/shared/data/users.repository';
import type { AuthUserWithPassword } from '@/modules/auth/shared/domain/auth_user.types';
import type { SessionRecord } from '@/modules/auth/shared/domain/session.types';

export const findLoginCandidateByEmail = (email: string): Promise<AuthUserWithPassword | null> =>
  findUserByEmail(email);

export const openLoginSession = (input: CreateSessionInput): Promise<SessionRecord> =>
  createSession(input);
