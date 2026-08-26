import { revokeCurrentSession } from '@/modules/auth/features/session/logout/data/logout.repository';
import type { LogoutPayload } from '@/modules/auth/features/session/logout/domain/logout.payload';
import type { LogoutResult } from '@/modules/auth/features/session/logout/domain/logout.types';

export const logoutService = async (payload: LogoutPayload): Promise<LogoutResult> => {
  const revoked_count = await revokeCurrentSession(payload.session_id);

  return { already_revoked: revoked_count === 0 };
};
