import type { z } from 'zod';

import type { createEnrollmentSchema } from '@/modules/progress/features/enrollment/create/domain/create.schema';

export type CreateEnrollmentPayload = z.infer<typeof createEnrollmentSchema>;
