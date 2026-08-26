import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';
import { ValidationKeys } from '@/constants/validation_keys';
import { isSafeRedirect } from '@/utils/safe_redirect';

export const googleStartSchema = z.object({
  redirect_to: z
    .string(ValidationKeys.auth.redirect_to_invalid)
    .max(AuthPolicy.redirect_to_max_length, ValidationKeys.auth.redirect_to_invalid)
    .refine(isSafeRedirect, ValidationKeys.auth.redirect_to_invalid)
    .optional(),
});
