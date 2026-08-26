import type { z } from 'zod';

import type { updateProfileSchema } from '@/modules/user/features/profile/update/domain/update.schema';

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
