import type { z } from 'zod';

import type { googleCallbackSchema } from '@/modules/auth/features/google_login/callback/domain/callback.schema';

export type GoogleCallbackPayload = z.infer<typeof googleCallbackSchema>;
