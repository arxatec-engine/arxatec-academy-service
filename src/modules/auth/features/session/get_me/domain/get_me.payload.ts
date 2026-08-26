import type { z } from 'zod';

import type { getMeSchema } from '@/modules/auth/features/session/get_me/domain/get_me.schema';

export type GetMePayload = z.infer<typeof getMeSchema>;
