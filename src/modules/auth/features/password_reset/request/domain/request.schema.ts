import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';
import { ValidationKeys } from '@/constants/validation_keys';
import { isSafeRedirect } from '@/utils/safe_redirect';

export const requestPasswordResetSchema = z.object({
  email: z
    .string({ error: ValidationKeys.auth.email_invalid })
    .trim()
    .toLowerCase()
    .max(AuthPolicy.email_max_length, ValidationKeys.auth.email_too_long)
    .pipe(z.email({ error: ValidationKeys.auth.email_invalid })),
  redirect_to: z
    .string({ error: ValidationKeys.auth.redirect_to_invalid })
    .max(AuthPolicy.redirect_to_max_length, ValidationKeys.auth.redirect_to_invalid)
    .refine(isSafeRedirect, { error: ValidationKeys.auth.redirect_to_invalid })
    .optional(),
});
