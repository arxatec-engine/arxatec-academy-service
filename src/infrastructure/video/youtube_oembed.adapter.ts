import { fetchOembed } from '@/infrastructure/video/oembed_response';
import type { VideoProviderPort } from '@/infrastructure/video/video_provider.port';

export const youtubeOembedAdapter: VideoProviderPort = {
  async probe(external_id) {
    const url = new URL('https://www.youtube.com/oembed');
    url.searchParams.set('url', `https://www.youtube.com/watch?v=${external_id}`);
    url.searchParams.set('format', 'json');
    const raw = await fetchOembed(url);
    return {
      duration_seconds: null,
      title: typeof raw['title'] === 'string' ? raw['title'] : '',
      thumbnail_url: typeof raw['thumbnail_url'] === 'string' ? raw['thumbnail_url'] : null,
    };
  },
};
