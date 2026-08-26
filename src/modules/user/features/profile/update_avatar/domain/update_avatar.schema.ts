import { z } from 'zod';

import { ValidationKeys } from '@/constants/validation_keys';

export const updateAvatarSchema = z.object({
  user_id: z.string().min(1, ValidationKeys.common.required),
  mime_type: z
    .string(ValidationKeys.user.avatar_required)
    .min(1, ValidationKeys.user.avatar_required),
  size_bytes: z.number(ValidationKeys.user.avatar_required).int().nonnegative(),
});
