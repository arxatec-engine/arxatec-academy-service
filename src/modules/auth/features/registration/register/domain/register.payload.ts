import type { z } from 'zod';

import type { registerSchema } from '@/modules/auth/features/registration/register/domain/register.schema';

export type RegisterPayload = z.infer<typeof registerSchema>;

export type RegisterRequest = z.input<typeof registerSchema>;
