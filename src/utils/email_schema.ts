import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';
import { ValidationKeys } from '@/constants/validation_keys';

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
export const emailSchema = z.string(ValidationKeys.auth.email_invalid).transform(normalizeEmail)
  .pipe(z.email(ValidationKeys.auth.email_invalid)
    .max(AuthPolicy.email_max_length, ValidationKeys.auth.email_too_long));
