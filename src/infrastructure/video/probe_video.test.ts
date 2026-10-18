import { ErrorCodes } from '@/constants/error_codes';
import { video_provider } from '@/generated/enums';
import { probeVideo } from '@/infrastructure/video/probe_video';

jest.mock('@/config/env', () => ({ env: { VIDEO_PROVIDER_DRIVER: 'live', VIDEO_PROBE_TIMEOUT_MS: 3000 } }));

const fetchMock = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>();
const originalFetch = global.fetch;

beforeAll(() => { global.fetch = fetchMock; });
afterEach(() => { fetchMock.mockReset(); });
afterAll(() => { global.fetch = originalFetch; });

it('elige el adaptador Vimeo y lee la duración del proveedor', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ duration: 183, title: 'Vimeo' }), { status: 200 }));
  await expect(probeVideo(video_provider.VIMEO, '12345')).resolves.toEqual({
    duration_seconds: 183, title: 'Vimeo', thumbnail_url: null,
  });
  const calledUrl = fetchMock.mock.calls[0]?.[0];
  expect(calledUrl).toBeInstanceOf(URL);
  if (calledUrl instanceof URL) {expect(calledUrl.host).toBe('vimeo.com');}
});

it('elige YouTube y deja explícito que su oEmbed no incluye duración', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ title: 'YouTube', thumbnail_url: 'https://a.test/x' }),
    { status: 200 }));
  await expect(probeVideo(video_provider.YOUTUBE, 'dQw4w9WgXcQ')).resolves.toEqual({
    duration_seconds: null, title: 'YouTube', thumbnail_url: 'https://a.test/x',
  });
  const calledUrl = fetchMock.mock.calls[0]?.[0];
  expect(calledUrl).toBeInstanceOf(URL);
  if (calledUrl instanceof URL) {expect(calledUrl.host).toBe('www.youtube.com');}
});

it('distingue video ausente y fallo temporal sin confundirlos', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockRejectedValueOnce(new Error('network'));
  await expect(probeVideo(video_provider.YOUTUBE, 'dQw4w9WgXcQ'))
    .rejects.toMatchObject({ meta: { code: ErrorCodes.VIDEO_NOT_FOUND } });
  await expect(probeVideo(video_provider.VIMEO, '12345'))
    .rejects.toMatchObject({ meta: { code: ErrorCodes.VIDEO_PROVIDER_UNAVAILABLE } });
});
