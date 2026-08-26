import { sign } from 'jsonwebtoken';

import { env } from '@/config/env';
import { JwtAlgorithm } from '@/constants/auth';
import type { user_role } from '@/generated/enums';

export interface SignSessionTokenInput {
  user_id: string;
  session_id: string;
  role: user_role;
  absolute_expires_at: Date;
  issued_at?: Date;
}

const toUnixSeconds = (value: Date): number => Math.floor(value.getTime() / 1000);

export const signSessionToken = ({
  user_id,
  session_id,
  role,
  absolute_expires_at,
  issued_at = new Date(),
}: SignSessionTokenInput): string =>
  sign(
    {
      sub: user_id,
      jti: session_id,
      role,
      iat: toUnixSeconds(issued_at),
      exp: toUnixSeconds(absolute_expires_at),
    },
    env.JWT_SECRET,
    { algorithm: JwtAlgorithm, issuer: env.JWT_ISSUER },
  );
