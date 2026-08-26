import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';
import { ValidationKeys } from '@/constants/validation_keys';

export const resetPasswordSchema = z.object({
  token: z
    .string({ error: ValidationKeys.auth.token_required })
    .trim()
    .min(1, ValidationKeys.auth.token_required),
  password: z
    .string({ error: ValidationKeys.auth.password_too_short })
    .min(AuthPolicy.password_min_length, ValidationKeys.auth.password_too_short)
    .max(AuthPolicy.password_max_length, ValidationKeys.auth.password_too_long),
});
