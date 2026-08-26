import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

import { AuthHeaders, AuthRateLimits } from '@/constants/auth';
import { CommentRateLimits } from '@/constants/comments';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { CommentMessages } from '@/constants/messages/comments';
import { ProgressMessages } from '@/constants/messages/progress';
import { ProgressRateLimits } from '@/constants/progress';
import { AppError } from '@/utils/errors';

export interface RateLimitDefinition {
  window_seconds: number;
  max: number;
}

export interface CreateRateLimiterInput {
  definition: RateLimitDefinition;
  description: string;
  keyBy?: (req: Request) => string;
}

const readBodyString = (body: unknown, field: string): string => {
  if (typeof body !== 'object' || body === null || !(field in body)) {
    return '';
  }

  const value: unknown = Reflect.get(body, field);

  return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

const KEY_SEPARATOR = '|';

export const ipKey = (req: Request): string => ipKeyGenerator(req.ip ?? '');

export const emailKey = (req: Request): string => readBodyString(req.body, 'email');

export const userKey = (req: Request): string => req.user?.id ?? ipKey(req);

export const createRateLimiter = ({
  definition,
  description,
  keyBy = ipKey,
}: CreateRateLimiterInput): RequestHandler =>
  rateLimit({
    windowMs: definition.window_seconds * 1000,
    limit: definition.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: keyBy,
    handler: (_req, res, next) => {
      res.setHeader(AuthHeaders.retry_after, definition.window_seconds);

      next(
        new AppError(description, HttpStatusCodes.TOO_MANY_REQUESTS.code, {
          code: ErrorCodes.RATE_LIMITED,
          retry_after_seconds: definition.window_seconds,
        }),
      );
    },
  });

export const loginByIpRateLimit = createRateLimiter({
  definition: AuthRateLimits.login_by_ip,
  description: AuthMessages.rate_limit.login,
});

export const loginByAccountRateLimit = createRateLimiter({
  definition: AuthRateLimits.login_by_account,
  description: AuthMessages.rate_limit.login,
  keyBy: (req) => `${ipKey(req)}${KEY_SEPARATOR}${emailKey(req)}`,
});

export const registerRateLimit = createRateLimiter({
  definition: AuthRateLimits.register,
  description: AuthMessages.rate_limit.register,
});

export const passwordForgotByIpRateLimit = createRateLimiter({
  definition: AuthRateLimits.password_forgot_by_ip,
  description: AuthMessages.rate_limit.password_forgot,
});

export const passwordForgotByEmailRateLimit = createRateLimiter({
  definition: AuthRateLimits.password_forgot_by_email,
  description: AuthMessages.rate_limit.password_forgot,
  keyBy: emailKey,
});

export const passwordResetRateLimit = createRateLimiter({
  definition: AuthRateLimits.password_reset,
  description: AuthMessages.rate_limit.password_reset,
});

export const emailVerifyRateLimit = createRateLimiter({
  definition: AuthRateLimits.email_verify,
  description: AuthMessages.rate_limit.email_verify,
});

export const emailResendRateLimit = createRateLimiter({
  definition: AuthRateLimits.email_resend,
  description: AuthMessages.rate_limit.email_resend,
  keyBy: userKey,
});

export const googleExchangeRateLimit = createRateLimiter({
  definition: AuthRateLimits.google_exchange,
  description: AuthMessages.rate_limit.google_exchange,
});

export const lessonProgressRateLimit = createRateLimiter({
  definition: ProgressRateLimits.lesson_progress,
  description: ProgressMessages.rate_limit.lesson_progress,
  keyBy: userKey,
});

export const commentRateLimit = createRateLimiter({
  definition: CommentRateLimits.create,
  description: CommentMessages.rate_limit.create,
  keyBy: userKey,
});
