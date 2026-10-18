import { env } from '@/config/env';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AdminLessonMessages } from '@/constants/messages/admin_lessons';
import { AppError } from '@/utils/errors';

export const videoUnavailable = (): AppError => new AppError(AdminLessonMessages.video_unavailable,
  HttpStatusCodes.BAD_GATEWAY.code, { code: ErrorCodes.VIDEO_PROVIDER_UNAVAILABLE });

export const fetchOembed = async (url: URL): Promise<Record<string, unknown>> => {
  let response: globalThis.Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(env.VIDEO_PROBE_TIMEOUT_MS) });
  } catch {
    throw videoUnavailable();
  }
  if (response.status === HttpStatusCodes.NOT_FOUND.code) {
    throw new AppError(AdminLessonMessages.video_not_found, HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      { code: ErrorCodes.VIDEO_NOT_FOUND });
  }
  if (response.status === HttpStatusCodes.FORBIDDEN.code || response.status === 401) {
    throw new AppError(AdminLessonMessages.video_not_embeddable, HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      { code: ErrorCodes.VIDEO_NOT_EMBEDDABLE });
  }
  if (!response.ok) {throw videoUnavailable();}
  try {
    const raw: unknown = await response.json();
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {throw videoUnavailable();}
    return raw as Record<string, unknown>;
  } catch {
    throw videoUnavailable();
  }
};
