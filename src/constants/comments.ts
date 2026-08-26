export const CommentPolicy = {
  id_max_length: 64,
  body_min_length: 1,
  body_max_length: 2000,
  reason_max_length: 280,
} as const;

export const CommentRateLimits = {
  create: { window_seconds: 60 * 60, max: 5 },
} as const;
