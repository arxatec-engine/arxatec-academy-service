import { TokenExpiredError, verify } from 'jsonwebtoken';

import { env } from '@/config/env';
import { JwtAlgorithm } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import {
  sessionTokenPayloadSchema,
  type SessionTokenPayload,
} from '@/infrastructure/jwt/session_token.schema';
import { AppError } from '@/utils/errors';

export type SessionTokenResult =
  { valid: true; payload: SessionTokenPayload } | { valid: false; expired: boolean };

const expiredError = (): AppError =>
  new AppError(AuthMessages.session.expired, HttpStatusCodes.UNAUTHORIZED.code, {
    code: ErrorCodes.SESSION_EXPIRED,
  });

const malformedError = (): AppError =>
  new AppError(AuthMessages.session.token_malformed, HttpStatusCodes.UNAUTHORIZED.code, {
    code: ErrorCodes.UNAUTHENTICATED,
  });

export const readSessionToken = (token: string): SessionTokenResult => {
  let decoded: unknown;

  try {
    decoded = verify(token, env.JWT_SECRET, {
      algorithms: [JwtAlgorithm],
      issuer: env.JWT_ISSUER,
    });
  } catch (error: unknown) {
    return { valid: false, expired: error instanceof TokenExpiredError };
  }

  const parsed = sessionTokenPayloadSchema.safeParse(decoded);

  return parsed.success ? { valid: true, payload: parsed.data } : { valid: false, expired: false };
};

export const verifySessionToken = (token: string): SessionTokenPayload => {
  const result = readSessionToken(token);

  if (result.valid) {
    return result.payload;
  }

  throw result.expired ? expiredError() : malformedError();
};
