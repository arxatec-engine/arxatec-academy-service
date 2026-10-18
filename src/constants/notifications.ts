export const NotificationRateLimits = {
  public_by_ip: { window_seconds: 3600, max: 10 },
  public_by_email: { window_seconds: 3600, max: 5 },
  export: { window_seconds: 3600, max: 20 },
} as const;

export const NotificationPolicy = { search_term_max_length: 120, default_page_size: 25, max_page_size: 100 } as const;
