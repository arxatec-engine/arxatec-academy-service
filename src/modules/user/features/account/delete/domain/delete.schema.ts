import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';
import { ValidationKeys } from '@/constants/validation_keys';

export const deleteAccountSchema = z.object({
  user_id: z.string().min(1, ValidationKeys.common.required),
  password: z
    .string(ValidationKeys.user.password_required)
    .max(AuthPolicy.password_max_length, ValidationKeys.auth.password_too_long)
    .nullish(),
});
