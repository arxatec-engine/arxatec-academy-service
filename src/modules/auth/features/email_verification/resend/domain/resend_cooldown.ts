import { AuthPolicy } from '@/constants/auth';

export interface ResendCooldownInput {
  last_sent_at: Date | null;
  now?: Date;
}

export interface ResendCooldown {
  allowed: boolean;
  retry_after_seconds: number;
}

const MILLISECONDS_PER_SECOND = 1000;

export const resolveResendCooldown = ({
  last_sent_at,
  now = new Date(),
}: ResendCooldownInput): ResendCooldown => {
  if (last_sent_at === null) {
    return { allowed: true, retry_after_seconds: AuthPolicy.resend_cooldown_seconds };
  }

  const elapsed_seconds = (now.getTime() - last_sent_at.getTime()) / MILLISECONDS_PER_SECOND;

  if (elapsed_seconds >= AuthPolicy.resend_cooldown_seconds) {
    return { allowed: true, retry_after_seconds: AuthPolicy.resend_cooldown_seconds };
  }

  const remaining_seconds = Math.ceil(AuthPolicy.resend_cooldown_seconds - elapsed_seconds);

  return {
    allowed: false,
    retry_after_seconds: Math.min(
      AuthPolicy.resend_cooldown_seconds,
      Math.max(1, remaining_seconds),
    ),
  };
};
