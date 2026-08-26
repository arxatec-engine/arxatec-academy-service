import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import { env } from '@/config/env';
import { AuthPolicy } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { AppError } from '@/utils/errors';
import { isSafeRedirect } from '@/utils/safe_redirect';

const STATE_CONTEXT = 'arxatec.academy.google.oauth.state.v1';
const STATE_SEPARATOR = '.';
const STATE_NONCE_BYTES = 16;

const oauthStatePayloadSchema = z.object({
  redirect_to: z.string(),
  nonce: z.string().min(1),
  issued_at: z.number().int().positive(),
});

export type OauthStatePayload = z.infer<typeof oauthStatePayloadSchema>;

export interface SignOauthStateInput {
  redirect_to: string;
  now?: Date;
}

export interface SignedOauthState {
  state: string;
  nonce: string;
}

export interface VerifyOauthStateInput {
  state: unknown;
  nonce: string;
  now?: Date;
}

const invalidState = (): AppError =>
  new AppError(AuthMessages.google.state_invalid, HttpStatusCodes.BAD_REQUEST.code, {
    code: ErrorCodes.TOKEN_INVALID,
  });

const signature = (encoded_payload: string): string =>
  createHmac('sha256', env.JWT_SECRET)
    .update(`${STATE_CONTEXT}${STATE_SEPARATOR}${encoded_payload}`, 'utf8')
    .digest('base64url');

const isSameSecret = (expected: string, received: string): boolean => {
  const expected_bytes = Buffer.from(expected, 'utf8');
  const received_bytes = Buffer.from(received, 'utf8');

  if (expected_bytes.length !== received_bytes.length) {
    return false;
  }

  return timingSafeEqual(expected_bytes, received_bytes);
};

const readJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    throw invalidState();
  }
};

const decodePayload = (encoded_payload: string): OauthStatePayload => {
  const decoded = Buffer.from(encoded_payload, 'base64url').toString('utf8');

  const parsed = oauthStatePayloadSchema.safeParse(readJson(decoded));

  if (!parsed.success) {
    throw invalidState();
  }

  return parsed.data;
};

export const signOauthState = ({
  redirect_to,
  now = new Date(),
}: SignOauthStateInput): SignedOauthState => {
  if (!isSafeRedirect(redirect_to)) {
    throw new AppError(AuthMessages.redirect.invalid, HttpStatusCodes.UNPROCESSABLE_ENTITY.code, {
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  const nonce = randomBytes(STATE_NONCE_BYTES).toString('base64url');

  const payload: OauthStatePayload = {
    redirect_to,
    nonce,
    issued_at: Math.floor(now.getTime() / 1000),
  };

  const encoded_payload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

  return { state: `${encoded_payload}${STATE_SEPARATOR}${signature(encoded_payload)}`, nonce };
};

export const verifyOauthState = ({
  state,
  nonce,
  now = new Date(),
}: VerifyOauthStateInput): string => {
  if (typeof state !== 'string' || nonce.length === 0) {
    throw invalidState();
  }

  const parts = state.split(STATE_SEPARATOR);

  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    throw invalidState();
  }

  if (!isSameSecret(signature(parts[0]), parts[1])) {
    throw invalidState();
  }

  const payload = decodePayload(parts[0]);
  const age_seconds = Math.floor(now.getTime() / 1000) - payload.issued_at;

  if (age_seconds < 0 || age_seconds > AuthPolicy.oauth_state_max_age_seconds) {
    throw invalidState();
  }

  if (!isSameSecret(payload.nonce, nonce)) {
    throw invalidState();
  }

  if (!isSafeRedirect(payload.redirect_to)) {
    throw invalidState();
  }

  return payload.redirect_to;
};
