import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';
import { ValidationKeys } from '@/constants/validation_keys';

export const loginSchema = z.object({
  email: z
    .string(ValidationKeys.auth.email_invalid)
    .trim()
    .toLowerCase()
    .pipe(
      z
        .email(ValidationKeys.auth.email_invalid)
        .max(AuthPolicy.email_max_length, ValidationKeys.auth.email_too_long),
    ),
  password: z
    .string(ValidationKeys.common.required)
    .min(1, ValidationKeys.common.required)
    .max(AuthPolicy.password_max_length, ValidationKeys.auth.password_too_long),
  remember_me: z.boolean(ValidationKeys.auth.remember_me_invalid).optional().default(true),
});
