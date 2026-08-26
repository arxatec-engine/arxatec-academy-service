import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';
import { ValidationKeys } from '@/constants/validation_keys';

export const updatePasswordSchema = z
  .object({
    user_id: z.string().min(1, ValidationKeys.common.required),
    session_id: z.string().min(1, ValidationKeys.common.required),
    current_password: z
      .string(ValidationKeys.user.current_password_required)
      .min(1, ValidationKeys.user.current_password_required),
    new_password: z
      .string(ValidationKeys.auth.password_too_short)
      .min(AuthPolicy.password_min_length, ValidationKeys.auth.password_too_short)
      .max(AuthPolicy.password_max_length, ValidationKeys.auth.password_too_long),
  })
  .superRefine((value, ctx) => {
    if (value.new_password === value.current_password) {
      ctx.addIssue({
        code: 'custom',
        path: ['new_password'],
        message: ValidationKeys.user.password_same_as_current,
      });
    }
  });
