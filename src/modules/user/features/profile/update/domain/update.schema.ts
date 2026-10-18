import { z } from 'zod';

import { ValidationKeys } from '@/constants/validation_keys';
import { accountProfileShape } from '@/modules/auth/shared/domain/account_fields.schema';

export const updateProfileSchema = z.object({
  user_id: z.string().min(1, ValidationKeys.common.required),
  full_name: accountProfileShape.full_name,
});
