import { revokeSession } from '@/modules/auth/shared/data/sessions.repository';

export const revokeCurrentSession = (session_id: string): Promise<number> =>
  revokeSession(session_id);
