import cors from 'cors';

import { env } from '@/config/env';
import { CorsPolicy } from '@/constants/server';

const allowedOrigin = new URL(env.FRONTEND_URL).origin;

export const corsHandler = cors({
  origin: (origin, callback) => {
    callback(null, origin === undefined || origin === allowedOrigin);
  },
  credentials: CorsPolicy.credentials,
  methods: [...CorsPolicy.methods],
  allowedHeaders: [...CorsPolicy.allowed_headers],
  exposedHeaders: [...CorsPolicy.exposed_headers],
  maxAge: CorsPolicy.max_age_seconds,
});
