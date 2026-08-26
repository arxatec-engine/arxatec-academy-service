import { resolveAccountFields } from '@/modules/auth/shared/domain/account_fields';
import { toApiUser } from '@/modules/auth/shared/domain/user_mapper';
import type { UpdateProfilePayload } from '@/modules/user/features/profile/update/domain/update.payload';
import type { UpdateProfileResult } from '@/modules/user/features/profile/update/domain/update.types';
import { updateUserProfile } from '@/modules/user/shared/data/user_account.repository';

export const updateProfileService = async (
  payload: UpdateProfilePayload,
): Promise<UpdateProfileResult> => {
  const fields = resolveAccountFields({
    organization: payload.organization,
    is_independent: payload.is_independent,
    city: payload.city,
    city_other: payload.city_other,
  });

  const user = await updateUserProfile({
    user_id: payload.user_id,
    full_name: payload.full_name,
    organization: fields.organization,
    is_independent: payload.is_independent,
    city: payload.city,
    city_other: fields.city_other,
  });

  return { user: toApiUser(user) };
};
