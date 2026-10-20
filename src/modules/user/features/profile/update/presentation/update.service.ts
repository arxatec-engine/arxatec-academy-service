import { resolveStoredFileUrl } from '@/infrastructure/storage/file_url';
import { toApiUser } from '@/modules/auth/shared/domain/user_mapper';
import type { UpdateProfilePayload } from '@/modules/user/features/profile/update/domain/update.payload';
import type { UpdateProfileResult } from '@/modules/user/features/profile/update/domain/update.types';
import { updateUserProfile } from '@/modules/user/shared/data/user_account.repository';

export const updateProfileService = async (
  payload: UpdateProfilePayload,
): Promise<UpdateProfileResult> => {
  const user = await updateUserProfile({
    user_id: payload.user_id,
    full_name: payload.full_name,
  });

  return { user: toApiUser(user, resolveStoredFileUrl) };
};
