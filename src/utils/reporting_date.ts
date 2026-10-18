import { env } from '@/config/env';

const shifted = (date: Date): Date =>
  new Date(date.getTime() + env.REPORTING_UTC_OFFSET_MINUTES * 60_000);

export const reportingDay = (date: Date): string => shifted(date).toISOString().slice(0, 10);

export const reportingWeekStart = (date: Date): Date => {
  const local = shifted(date);
  const weekday = (local.getUTCDay() + 6) % 7;
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - weekday);
  return new Date(midnight - env.REPORTING_UTC_OFFSET_MINUTES * 60_000);
};
