import type { ApiUser } from '@/modules/auth/shared/domain/auth_user.types';
import type { UpdateAvatarPayload } from '@/modules/user/features/profile/update_avatar/domain/update_avatar.payload';

export interface UpdateAvatarCommand extends UpdateAvatarPayload {
  content: Buffer;
}

export interface UpdateAvatarResult {
  user: ApiUser;
}
