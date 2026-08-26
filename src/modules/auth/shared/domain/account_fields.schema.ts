import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';
import { ValidationKeys } from '@/constants/validation_keys';
import { user_city } from '@/generated/enums';

export interface AccountCityFields {
  city: user_city;
  city_other?: string | null;
}

export const accountProfileShape = {
  full_name: z
    .string(ValidationKeys.auth.full_name_required)
    .trim()
    .min(AuthPolicy.full_name_min_length, ValidationKeys.auth.full_name_required)
    .max(AuthPolicy.full_name_max_length, ValidationKeys.auth.full_name_too_long),
  organization: z
    .string(ValidationKeys.auth.organization_too_long)
    .trim()
    .max(AuthPolicy.organization_max_length, ValidationKeys.auth.organization_too_long)
    .nullish(),
  is_independent: z.boolean(ValidationKeys.common.invalid).default(false),
  city: z.enum(user_city, ValidationKeys.auth.city_invalid),
  city_other: z
    .string(ValidationKeys.auth.city_other_required)
    .trim()
    .max(AuthPolicy.city_other_max_length, ValidationKeys.auth.city_other_too_long)
    .nullish(),
};

export const requireCityOther = (value: AccountCityFields, ctx: z.RefinementCtx): void => {
  if (value.city !== user_city.OTHER) {
    return;
  }

  if (value.city_other === null || value.city_other === undefined || value.city_other === '') {
    ctx.addIssue({
      code: 'custom',
      path: ['city_other'],
      message: ValidationKeys.auth.city_other_required,
    });
  }
};
