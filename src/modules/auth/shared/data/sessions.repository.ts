import { prisma } from '@/config/prisma_client';
import { AuthPolicy } from '@/constants/auth';
import type { Prisma } from '@/generated/client';
import type { SessionRecord, SessionWithUser } from '@/modules/auth/shared/domain/session.types';

const SESSION_SELECT = {
  id: true,
  user_id: true,
  remember_me: true,
  created_at: true,
  expires_at: true,
  last_used_at: true,
  revoked_at: true,
} as const;

const SESSION_WITH_USER_SELECT = {
  ...SESSION_SELECT,
  user: {
    select: { id: true, email: true, role: true, email_verified_at: true },
  },
} as const;

export interface CreateSessionInput {
  user_id: string;
  remember_me: boolean;
  expires_at: Date;
  user_agent?: string | null;
  ip_address?: string | null;
}

export interface TouchSessionInput {
  last_used_at: Date;
  expires_at: Date;
}

const truncate = (value: string | null | undefined, max_length: number): string | null => {
  if (value === null || value === undefined || value.length === 0) {
    return null;
  }

  return value.slice(0, max_length);
};

export const createSession = async (input: CreateSessionInput): Promise<SessionRecord> =>
  prisma.auth_sessions.create({
    data: {
      user_id: input.user_id,
      remember_me: input.remember_me,
      expires_at: input.expires_at,
      user_agent: truncate(input.user_agent, AuthPolicy.user_agent_max_length),
      ip_address: truncate(input.ip_address, AuthPolicy.ip_address_max_length),
    },
    select: SESSION_SELECT,
  });

export const findSessionById = async (id: string): Promise<SessionWithUser | null> =>
  prisma.auth_sessions.findUnique({ where: { id }, select: SESSION_WITH_USER_SELECT });

export const revokeSession = async (id: string, revoked_at: Date = new Date()): Promise<number> => {
  const result = await prisma.auth_sessions.updateMany({
    where: { id, revoked_at: null },
    data: { revoked_at },
  });

  return result.count;
};

export interface RevokeOtherSessionsInput {
  user_id: string;
  except_session_id: string;
  revoked_at?: Date;
}

export const revokeOtherUserSessions = async (
  { user_id, except_session_id, revoked_at = new Date() }: RevokeOtherSessionsInput,
  client: Prisma.TransactionClient = prisma,
): Promise<number> => {
  const result = await client.auth_sessions.updateMany({
    where: { user_id, revoked_at: null, id: { not: except_session_id } },
    data: { revoked_at },
  });

  return result.count;
};

export const revokeAllUserSessions = async (
  user_id: string,
  revoked_at: Date = new Date(),
): Promise<number> => {
  const result = await prisma.auth_sessions.updateMany({
    where: { user_id, revoked_at: null },
    data: { revoked_at },
  });

  return result.count;
};

export const touchSession = async (id: string, input: TouchSessionInput): Promise<void> => {
  await prisma.auth_sessions.updateMany({
    where: { id, revoked_at: null },
    data: { last_used_at: input.last_used_at, expires_at: input.expires_at },
  });
};
