export const ProgressPolicy = {
  lesson_id_max_length: 64,
  min_position_seconds: 0,
  max_position_seconds: 24 * 60 * 60,
} as const;

export const ProgressRateLimits = {
  lesson_progress: { window_seconds: 1, max: 1 },
} as const;
