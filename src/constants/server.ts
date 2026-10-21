export const ServerPolicy = {
  trust_proxy_hops: 1,
  json_body_limit: '1mb',
  url_encoded_body_limit: '1mb',
  shutdown_timeout_seconds: 10,
  request_id_max_length: 128,
} as const;

export const CorsPolicy = {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowed_headers: ['Content-Type', 'Authorization', 'x-request-id'],
  exposed_headers: ['x-request-id', 'Retry-After'],
  max_age_seconds: 600,
  credentials: true,
} as const;

export const ShutdownSignals = ['SIGTERM', 'SIGINT'] as const;

export type ShutdownSignal = (typeof ShutdownSignals)[number];

export const CloseableNames = {
  http_server: 'http_server',
  prisma: 'prisma',
  mail_transport: 'mail_transport',
  storage_cleanup: 'storage_cleanup',
} as const;

export const ProcessEvents = {
  uncaught_exception: 'uncaughtException',
  unhandled_rejection: 'unhandledRejection',
} as const;
