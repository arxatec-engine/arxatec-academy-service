import { video_provider } from '@/generated/enums';
import type { VideoProviderPort } from '@/infrastructure/video/video_provider.port';

export const fakeVideoAdapters: Record<video_provider, VideoProviderPort> = {
  [video_provider.VIMEO]: { probe() {
    return Promise.resolve({ duration_seconds: 480, title: 'Video de prueba', thumbnail_url: null });
  } },
  [video_provider.YOUTUBE]: { probe() {
    return Promise.resolve({ duration_seconds: null, title: 'Video de prueba', thumbnail_url: null });
  } },
};
