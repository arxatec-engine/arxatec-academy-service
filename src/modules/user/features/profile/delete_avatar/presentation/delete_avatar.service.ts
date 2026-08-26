import { toApiUser } from '@/modules/auth/shared/domain/user_mapper';
import type { DeleteAvatarPayload } from '@/modules/user/features/profile/delete_avatar/domain/delete_avatar.payload';
import type { DeleteAvatarResult } from '@/modules/user/features/profile/delete_avatar/domain/delete_avatar.types';
import { removeStoredAvatar } from '@/modules/user/shared/data/avatar_storage';
import { findUserAvatar, setUserAvatar } from '@/modules/user/shared/data/user_account.repository';
import { userNotFound } from '@/modules/user/shared/domain/user_not_found';

export const deleteAvatarService = async (
  payload: DeleteAvatarPayload,
): Promise<DeleteAvatarResult> => {
  const previous = await findUserAvatar(payload.user_id);

  if (previous === null) {
    throw userNotFound();
  }

  const user = await setUserAvatar({
    user_id: payload.user_id,
    avatar_url: null,
    avatar_key: null,
  });

  await removeStoredAvatar(previous.avatar_key);

  return { user: toApiUser(user) };
};
