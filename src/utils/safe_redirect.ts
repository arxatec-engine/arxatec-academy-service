import { AuthPolicy } from '@/constants/auth';
import { FrontendRoutes } from '@/constants/endpoints';

const RELATIVE_PATH_PATTERN = /^\/(?!\/)[^\s\\]*$/;

const hasControlCharacters = (value: string): boolean => {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }

  return false;
};

export const isSafeRedirect = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  if (value.length === 0 || value.length > AuthPolicy.redirect_to_max_length) {
    return false;
  }

  if (hasControlCharacters(value)) {
    return false;
  }

  return RELATIVE_PATH_PATTERN.test(value);
};

export const sanitizeRedirect = (value: unknown, fallback: string = FrontendRoutes.home): string =>
  isSafeRedirect(value) ? value : fallback;
