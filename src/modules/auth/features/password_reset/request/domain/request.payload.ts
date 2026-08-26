import type { z } from 'zod';

import type { requestPasswordResetSchema } from '@/modules/auth/features/password_reset/request/domain/request.schema';

export type RequestPasswordResetPayload = z.infer<typeof requestPasswordResetSchema>;
