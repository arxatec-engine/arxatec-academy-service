import type { Request, RequestHandler, Response } from 'express';
import passport, { type AuthenticateCallback, type Strategy } from 'passport';
import {
  Strategy as GoogleStrategy,
  type AuthenticateOptionsGoogle,
  type Profile,
  type VerifyCallback,
} from 'passport-google-oauth20';

import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { ErrorCodes, type ErrorCode } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { AppError, isAppError } from '@/utils/errors';

export const GoogleStrategyName = 'google';

export const GoogleScopes = ['profile', 'email'];

const GOOGLE_PROFILE_KEY = 'google_profile';

interface GoogleAuthenticator {
  use(strategy: Strategy): unknown;
  authenticate(
    strategy: typeof GoogleStrategyName,
    options: AuthenticateOptionsGoogle,
    callback?: AuthenticateCallback,
  ): RequestHandler;
}

const authenticator: GoogleAuthenticator = passport;

let strategyRegistered = false;

const googleUnavailable = (status: number, code: ErrorCode): AppError =>
  new AppError(AuthMessages.google.callback_failed, status, { code });

const verifyGoogleProfile = (
  _access_token: string,
  _refresh_token: string,
  profile: Profile,
  done: VerifyCallback,
): void => {
  done(null, false, { [GOOGLE_PROFILE_KEY]: profile });
};

const readGoogleStrategy = (): GoogleStrategy => {
  const client_id = env.GOOGLE_CLIENT_ID ?? '';
  const client_secret = env.GOOGLE_CLIENT_SECRET ?? '';

  if (client_id.length === 0 || client_secret.length === 0) {
    logger.error(
      { google_client_id: client_id.length > 0, google_client_secret: client_secret.length > 0 },
      AuthMessages.google.not_configured,
    );

    throw new AppError(
      AuthMessages.google.not_configured,
      HttpStatusCodes.INTERNAL_SERVER_ERROR.code,
      { code: ErrorCodes.INTERNAL_ERROR },
    );
  }

  return new GoogleStrategy(
    {
      clientID: client_id,
      clientSecret: client_secret,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    verifyGoogleProfile,
  );
};

const ensureGoogleStrategy = (): GoogleAuthenticator => {
  if (!strategyRegistered) {
    authenticator.use(readGoogleStrategy());
    strategyRegistered = true;
  }

  return authenticator;
};

const readProfileEnvelope = (info: unknown): object | undefined => {
  if (typeof info !== 'object' || info === null || !(GOOGLE_PROFILE_KEY in info)) {
    return undefined;
  }

  const profile: unknown = Reflect.get(info, GOOGLE_PROFILE_KEY);

  return typeof profile === 'object' && profile !== null ? profile : undefined;
};

const toHandshakeError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  logger.error({ err: error }, AuthMessages.google.callback_failed);

  return googleUnavailable(HttpStatusCodes.INTERNAL_SERVER_ERROR.code, ErrorCodes.INTERNAL_ERROR);
};

export const redirectToGoogle =
  (state: string): RequestHandler =>
  (req, res, next) => {
    ensureGoogleStrategy().authenticate(GoogleStrategyName, {
      scope: GoogleScopes,
      session: false,
      state,
    })(req, res, next);
  };

export const resolveGoogleProfile = (req: Request, res: Response): Promise<object> =>
  new Promise<object>((resolve, reject) => {
    const handler = ensureGoogleStrategy().authenticate(
      GoogleStrategyName,
      { session: false },
      (error: unknown, _user: Express.User | false | null | undefined, info?: unknown) => {
        if (error !== null && error !== undefined) {
          reject(toHandshakeError(error));

          return;
        }

        const profile = readProfileEnvelope(info);

        if (profile === undefined) {
          reject(googleUnavailable(HttpStatusCodes.BAD_REQUEST.code, ErrorCodes.TOKEN_INVALID));

          return;
        }

        resolve(profile);
      },
    );

    handler(req, res, (error?: unknown) => {
      reject(toHandshakeError(error));
    });
  });
