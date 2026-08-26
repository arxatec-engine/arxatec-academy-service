import type { z } from 'zod';

import type { googleStartSchema } from '@/modules/auth/features/google_login/start/domain/start.schema';

export type GoogleStartPayload = z.infer<typeof googleStartSchema>;
