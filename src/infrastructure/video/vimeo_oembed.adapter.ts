import { fetchOembed, videoUnavailable } from '@/infrastructure/video/oembed_response';
import type { VideoProviderPort } from '@/infrastructure/video/video_provider.port';

export const vimeoOembedAdapter: VideoProviderPort = {
  async probe(external_id) {
    const url = new URL('https://vimeo.com/api/oembed.json');
    url.searchParams.set('url', `https://vimeo.com/${external_id}`);
    const raw = await fetchOembed(url);
    if (typeof raw['duration'] !== 'number' || !Number.isInteger(raw['duration'])
      || raw['duration'] <= 0) {throw videoUnavailable();}
    return {
      duration_seconds: raw['duration'],
      title: typeof raw['title'] === 'string' ? raw['title'] : '',
      thumbnail_url: typeof raw['thumbnail_url'] === 'string' ? raw['thumbnail_url'] : null,
    };
  },
};
