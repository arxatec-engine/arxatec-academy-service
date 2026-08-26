import { z } from 'zod';

import { ValidationKeys } from '@/constants/validation_keys';

export const googleExchangeSchema = z.object({
  code: z.string(ValidationKeys.auth.code_required).min(1, ValidationKeys.auth.code_required),
});
