import { findUserById } from '@/modules/auth/shared/data/users.repository';
import type { AuthUserRecord } from '@/modules/auth/shared/domain/auth_user.types';

export const findSessionUser = (user_id: string): Promise<AuthUserRecord | null> =>
  findUserById(user_id);
