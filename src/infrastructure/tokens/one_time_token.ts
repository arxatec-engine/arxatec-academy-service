import { createHash, randomBytes } from 'node:crypto';

import { AuthPolicy } from '@/constants/auth';

export interface OneTimeToken {
  token: string;
  token_hash: string;
  expires_at: Date;
}

export const hashOneTimeToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

export const createOneTimeToken = (ttl_seconds: number, now: Date = new Date()): OneTimeToken => {
  const token = randomBytes(AuthPolicy.one_time_token_bytes).toString('base64url');

  return {
    token,
    token_hash: hashOneTimeToken(token),
    expires_at: new Date(now.getTime() + ttl_seconds * 1000),
  };
};

export const isTokenUsable = (
  token: { expires_at: Date; consumed_at: Date | null },
  now: Date = new Date(),
): boolean => token.consumed_at === null && token.expires_at.getTime() > now.getTime();
