import type { z } from 'zod';

import type { resetPasswordSchema } from '@/modules/auth/features/password_reset/reset/domain/reset.schema';

export type ResetPasswordPayload = z.infer<typeof resetPasswordSchema>;
