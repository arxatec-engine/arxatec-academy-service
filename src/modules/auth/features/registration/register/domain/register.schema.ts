import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';
import { ValidationKeys } from '@/constants/validation_keys';
import { user_city } from '@/generated/enums';
import {
  accountProfileShape,
  requireCityOther,
} from '@/modules/auth/shared/domain/account_fields.schema';
import { emailSchema } from '@/utils/email_schema';

const passwordSchema = z
  .string(ValidationKeys.auth.password_too_short)
  .min(AuthPolicy.password_min_length, ValidationKeys.auth.password_too_short)
  .max(AuthPolicy.password_max_length, ValidationKeys.auth.password_too_long);

export const registerSchema = z
  .object({
    ...accountProfileShape,
    city: accountProfileShape.city.optional(),
    email: emailSchema,
    password: passwordSchema,
  })
  .superRefine((values, ctx) => {
    if (values.city !== undefined) {
      requireCityOther({ ...values, city: values.city }, ctx);
    }
  })
  .transform((values) => ({ ...values, city: values.city ?? user_city.OTHER }));
