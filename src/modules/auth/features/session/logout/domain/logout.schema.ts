import { z } from 'zod';

import { ValidationKeys } from '@/constants/validation_keys';

export const logoutSchema = z.object({
  session_id: z.string().min(1, ValidationKeys.common.required),
});
