import type { ApiUser } from '@/modules/auth/shared/domain/auth_user.types';

export interface GetMeResult {
  user: ApiUser;
}
