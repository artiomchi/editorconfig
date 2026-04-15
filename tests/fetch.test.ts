import { buildRemoteUrl, buildConfigUrl, fetchRemoteConfig, fetchProjectConfig } from '../src/fetch.js';

const BASE = 'https://cdn.editorconfig.build/v1/projects';

describe('buildRemoteUrl', () => {
  it('returns untagged URL when tag is undefined', () => {
    expect(buildRemoteUrl('mytoken', undefined)).toBe(`${BASE}/mytoken/.editorconfig`);
  });

  it('returns tagged URL when tag is provided', () => {
    expect(buildRemoteUrl('mytoken', 'v2')).toBe(`${BASE}/mytoken/v2/.editorconfig`);
  });
});

describe('buildConfigUrl', () => {
  it('returns config URL without tag regardless of tag value', () => {
    expect(buildConfigUrl('mytoken')).toBe(`${BASE}/mytoken/config.json`);
  });
});

describe('fetchRemoteConfig', () => {
  const mockFetch = jest.fn();
  beforeAll(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('returns text on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => 'content' });
    await expect(fetchRemoteConfig('tok', undefined)).resolves.toBe('content');
  });

  it('throws on non-2xx', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchRemoteConfig('tok', undefined)).rejects.toThrow('HTTP 404');
  });

  it('uses tag in URL when provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '' });
    await fetchRemoteConfig('tok', 'v3');
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/tok/v3/.editorconfig`);
  });
});

describe('fetchProjectConfig', () => {
  const mockFetch = jest.fn();
  beforeAll(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('returns parsed JSON on success', async () => {
    const obj = { reporting: { enabled: true } };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => obj });
    await expect(fetchProjectConfig('tok')).resolves.toEqual(obj);
  });

  it('throws on non-2xx', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchProjectConfig('tok')).rejects.toThrow('HTTP 500');
  });
});
