import { env } from '@/config/env';
import { video_provider } from '@/generated/enums';
import { fakeVideoAdapters } from '@/infrastructure/video/fake.adapter';
import type { VideoProbe, VideoProviderPort } from '@/infrastructure/video/video_provider.port';
import { vimeoOembedAdapter } from '@/infrastructure/video/vimeo_oembed.adapter';
import { youtubeOembedAdapter } from '@/infrastructure/video/youtube_oembed.adapter';

const live: Record<video_provider, VideoProviderPort> = {
  [video_provider.VIMEO]: vimeoOembedAdapter,
  [video_provider.YOUTUBE]: youtubeOembedAdapter,
};

export const probeVideo = (provider: video_provider, external_id: string): Promise<VideoProbe> =>
  (env.VIDEO_PROVIDER_DRIVER === 'fake' ? fakeVideoAdapters : live)[provider].probe(external_id);
