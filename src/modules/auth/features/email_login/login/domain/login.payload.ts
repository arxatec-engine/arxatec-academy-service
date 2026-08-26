import type { z } from 'zod';

import type { loginSchema } from '@/modules/auth/features/email_login/login/domain/login.schema';

export type LoginPayload = z.infer<typeof loginSchema>;
