export const CommentPolicy = {
  id_max_length: 64,
  body_min_length: 1,
  body_max_length: 2000,
  reason_max_length: 280,
} as const;

export const CommentRateLimits = {
  create: { window_seconds: 60 * 60, max: 5 },
  moderation_write: { window_seconds: 60 * 60, max: 60 },
} as const;

export const ModerationPolicy = { default_page_size: 20, max_page_size: 50 } as const;
