import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import type { GoogleProfilePayload } from '@/modules/auth/features/google_login/callback/domain/callback.types';
import { normalizeEmail } from '@/modules/auth/shared/domain/normalize_email';
import { AppError } from '@/utils/errors';

const EMAIL_LOCAL_PART_SEPARATOR = '@';

export const googleProfileSchema = z.object({
  id: z.string().min(1).max(AuthPolicy.email_max_length),
  displayName: z.string().optional(),
  emails: z
    .array(
      z.object({
        value: z.string(),
        verified: z.union([z.boolean(), z.string()]).optional(),
      }),
    )
    .optional(),
  photos: z.array(z.object({ value: z.string() })).optional(),
});

const isVerified = (value: boolean | string | undefined): boolean =>
  value === true || value === 'true';

const resolveFullName = (display_name: string | undefined, email: string): string => {
  const trimmed = display_name?.trim() ?? '';
  const fallback = email.split(EMAIL_LOCAL_PART_SEPARATOR)[0];

  return (trimmed.length > 0 ? trimmed : fallback).slice(0, AuthPolicy.full_name_max_length);
};

export const toGoogleProfile = (raw_profile: unknown): GoogleProfilePayload => {
  const parsed = googleProfileSchema.safeParse(raw_profile);

  if (!parsed.success) {
    throw new AppError(AuthMessages.google.callback_failed, HttpStatusCodes.BAD_REQUEST.code, {
      code: ErrorCodes.TOKEN_INVALID,
    });
  }

  const primary_email = parsed.data.emails?.[0];

  if (primary_email === undefined || primary_email.value.trim().length === 0) {
    throw new AppError(
      AuthMessages.google.profile_without_email,
      HttpStatusCodes.BAD_REQUEST.code,
      { code: ErrorCodes.TOKEN_INVALID },
    );
  }

  const email = normalizeEmail(primary_email.value);

  return {
    provider_account_id: parsed.data.id,
    email,
    full_name: resolveFullName(parsed.data.displayName, email),
    avatar_url: parsed.data.photos?.[0]?.value ?? null,
    email_verified: isVerified(primary_email.verified),
  };
};
