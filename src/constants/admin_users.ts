export const AdminUsersPolicy = {
  default_per_page: 25,
  max_per_page: 100,
  export_rate_limit: { window_seconds: 3600, max: 5 },
} as const;
