import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';
import { ValidationKeys } from '@/constants/validation_keys';
import {
  accountProfileShape,
  requireCityOther,
} from '@/modules/auth/shared/domain/account_fields.schema';
import { normalizeEmail } from '@/modules/auth/shared/domain/normalize_email';

const emailSchema = z
  .string(ValidationKeys.auth.email_invalid)
  .transform(normalizeEmail)
  .pipe(
    z
      .email(ValidationKeys.auth.email_invalid)
      .max(AuthPolicy.email_max_length, ValidationKeys.auth.email_too_long),
  );

const passwordSchema = z
  .string(ValidationKeys.auth.password_too_short)
  .min(AuthPolicy.password_min_length, ValidationKeys.auth.password_too_short)
  .max(AuthPolicy.password_max_length, ValidationKeys.auth.password_too_long);

export const registerSchema = z
  .object({
    ...accountProfileShape,
    email: emailSchema,
    password: passwordSchema,
  })
  .superRefine(requireCityOther);
