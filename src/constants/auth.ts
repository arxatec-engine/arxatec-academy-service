export const AuthTokenTtlSeconds = {
  session_remember_me: 30 * 24 * 60 * 60,
  session_short: 12 * 60 * 60,
  session_absolute_max: 180 * 24 * 60 * 60,
  email_verification: 24 * 60 * 60,
  password_reset: 60 * 60,
  oauth_exchange_code: 60,
} as const;

export const AuthPolicy = {
  session_sliding_renewal_seconds: 5 * 60,
  resend_cooldown_seconds: 45,
  password_forgot_min_response_ms: 400,
  password_min_length: 8,
  password_max_length: 128,
  full_name_min_length: 2,
  full_name_max_length: 120,
  email_max_length: 254,
  organization_max_length: 160,
  city_other_max_length: 80,
  redirect_to_max_length: 512,
  user_agent_max_length: 512,
  ip_address_max_length: 64,
  one_time_token_bytes: 32,
  oauth_state_max_age_seconds: 10 * 60,
} as const;

export const AuthRateLimits = {
  login_by_ip: { window_seconds: 15 * 60, max: 30 },
  login_by_account: { window_seconds: 15 * 60, max: 10 },
  register: { window_seconds: 60 * 60, max: 5 },
  password_forgot_by_ip: { window_seconds: 60 * 60, max: 5 },
  password_forgot_by_email: { window_seconds: 60 * 60, max: 3 },
  password_reset: { window_seconds: 60 * 60, max: 20 },
  email_verify: { window_seconds: 60 * 60, max: 20 },
  email_resend: { window_seconds: 60 * 60, max: 5 },
  google_exchange: { window_seconds: 60 * 60, max: 20 },
} as const;

export const AuthCookies = {
  oauth_state_nonce: 'arxatec_oauth_state',
} as const;

export const AuthHeaders = {
  authorization: 'authorization',
  bearer_prefix: 'Bearer ',
  retry_after: 'Retry-After',
  request_id: 'x-request-id',
  user_agent: 'user-agent',
} as const;

export const JwtAlgorithm = 'HS256' as const;

export type AuthRateLimitName = keyof typeof AuthRateLimits;

export const SessionRejections = {
  missing_token: 'MISSING_TOKEN',
  token_invalid: 'TOKEN_INVALID',
  token_expired: 'TOKEN_EXPIRED',
  session_not_found: 'SESSION_NOT_FOUND',
  session_mismatch: 'SESSION_MISMATCH',
  session_revoked: 'SESSION_REVOKED',
  session_expired: 'SESSION_EXPIRED',
} as const;

export type SessionRejection = (typeof SessionRejections)[keyof typeof SessionRejections];
