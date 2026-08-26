import type { z } from 'zod';

import type { updatePasswordSchema } from '@/modules/user/features/profile/update_password/domain/update_password.schema';

export type UpdatePasswordPayload = z.infer<typeof updatePasswordSchema>;
