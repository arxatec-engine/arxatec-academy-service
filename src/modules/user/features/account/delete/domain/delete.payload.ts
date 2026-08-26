import type { z } from 'zod';

import type { deleteAccountSchema } from '@/modules/user/features/account/delete/domain/delete.schema';

export type DeleteAccountPayload = z.infer<typeof deleteAccountSchema>;
