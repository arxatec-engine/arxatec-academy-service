import type { z } from 'zod';

import type { updateAvatarSchema } from '@/modules/user/features/profile/update_avatar/domain/update_avatar.schema';

export type UpdateAvatarPayload = z.infer<typeof updateAvatarSchema>;
