import { z } from 'zod';

import { ValidationKeys } from '@/constants/validation_keys';

export const verifyEmailSchema = z.object({
  token: z
    .string(ValidationKeys.auth.token_required)
    .trim()
    .min(1, ValidationKeys.auth.token_required),
});
