import type { z } from 'zod';

import type { verifyEmailSchema } from '@/modules/auth/features/email_verification/verify/domain/verify.schema';

export type VerifyEmailPayload = z.infer<typeof verifyEmailSchema>;
