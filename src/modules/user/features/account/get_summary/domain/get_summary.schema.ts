import { z } from 'zod';

import { ValidationKeys } from '@/constants/validation_keys';

export const getSummarySchema = z.object({
  user_id: z.string().min(1, ValidationKeys.common.required),
});
