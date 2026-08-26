import type { z } from 'zod';

import type { deleteAvatarSchema } from '@/modules/user/features/profile/delete_avatar/domain/delete_avatar.schema';

export type DeleteAvatarPayload = z.infer<typeof deleteAvatarSchema>;
