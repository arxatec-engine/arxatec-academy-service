import { AuthPolicy, AuthTokenTtlSeconds } from '@/constants/auth';

export interface SessionExpiryInput {
  remember_me: boolean;
  now?: Date;
}

export interface SessionStatusInput {
  expires_at: Date;
  revoked_at: Date | null;
  now?: Date;
}

export interface SessionRenewalInput {
  remember_me: boolean;
  created_at: Date;
  last_used_at: Date;
  now?: Date;
}

export interface SessionRenewal {
  should_renew: boolean;
  last_used_at: Date;
  expires_at: Date;
}

export const resolveSessionTtlSeconds = (remember_me: boolean): number =>
  remember_me ? AuthTokenTtlSeconds.session_remember_me : AuthTokenTtlSeconds.session_short;

export const computeSessionExpiresAt = ({
  remember_me,
  now = new Date(),
}: SessionExpiryInput): Date =>
  new Date(now.getTime() + resolveSessionTtlSeconds(remember_me) * 1000);

export const computeSessionAbsoluteExpiresAt = (created_at: Date): Date =>
  new Date(created_at.getTime() + AuthTokenTtlSeconds.session_absolute_max * 1000);

export const isSessionRevoked = ({ revoked_at }: SessionStatusInput): boolean =>
  revoked_at !== null;

export const isSessionExpired = ({ expires_at, now = new Date() }: SessionStatusInput): boolean =>
  expires_at.getTime() <= now.getTime();

export const isSessionActive = (input: SessionStatusInput): boolean =>
  !isSessionRevoked(input) && !isSessionExpired(input);

export const resolveSessionRenewal = ({
  remember_me,
  created_at,
  last_used_at,
  now = new Date(),
}: SessionRenewalInput): SessionRenewal => {
  const elapsed_seconds = (now.getTime() - last_used_at.getTime()) / 1000;
  const sliding_expires_at = computeSessionExpiresAt({ remember_me, now });
  const absolute_expires_at = computeSessionAbsoluteExpiresAt(created_at);

  return {
    should_renew: elapsed_seconds >= AuthPolicy.session_sliding_renewal_seconds,
    last_used_at: now,
    expires_at:
      sliding_expires_at.getTime() < absolute_expires_at.getTime()
        ? sliding_expires_at
        : absolute_expires_at,
  };
};
