import { z } from 'zod';

import { user_role } from '@/generated/enums';

export const sessionTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  jti: z.string().min(1),
  role: z.enum(user_role),
  iss: z.string().min(1),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type SessionTokenPayload = z.infer<typeof sessionTokenPayloadSchema>;
