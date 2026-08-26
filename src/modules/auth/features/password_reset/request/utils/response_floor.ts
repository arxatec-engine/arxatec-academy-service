import { AuthPolicy } from '@/constants/auth';

export const waitForResponseFloor = async (
  started_at: number,
  minimum_ms: number = AuthPolicy.password_forgot_min_response_ms,
): Promise<void> => {
  const remaining_ms = minimum_ms - (Date.now() - started_at);

  if (remaining_ms <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, remaining_ms);
  });
};
