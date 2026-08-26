import type { z } from 'zod';

import type { logoutSchema } from '@/modules/auth/features/session/logout/domain/logout.schema';

export type LogoutPayload = z.infer<typeof logoutSchema>;
