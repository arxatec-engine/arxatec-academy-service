import type { z } from 'zod';

import type { googleExchangeSchema } from '@/modules/auth/features/google_login/exchange/domain/exchange.schema';

export type GoogleExchangePayload = z.infer<typeof googleExchangeSchema>;
