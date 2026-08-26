import { user_city } from '@/generated/enums';

export interface AccountFields {
  organization: string | null;
  city_other: string | null;
}

export interface ResolveAccountFieldsInput {
  organization: string | null | undefined;
  is_independent: boolean;
  city: user_city;
  city_other: string | null | undefined;
}

const emptyToNull = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined || value.trim() === '') {
    return null;
  }

  return value.trim();
};

export const resolveAccountFields = ({
  organization,
  is_independent,
  city,
  city_other,
}: ResolveAccountFieldsInput): AccountFields => ({
  organization: is_independent ? null : emptyToNull(organization),
  city_other: city === user_city.OTHER ? emptyToNull(city_other) : null,
});
