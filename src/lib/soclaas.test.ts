import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSoclaasApiKey,
  setSoclaasApiKey,
  getSoclaasEndpoint,
  setSoclaasEndpoint,
  callSoclaasChat,
  testSoclaasConnection,
} from './soclaas';

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe('soclaas client', () => {
  const storageMock = createStorageMock();

  beforeEach(() => {
    vi.stubGlobal('localStorage', storageMock);
    storageMock.clear();
    vi.restoreAllMocks();
  });

  it('gets and sets API key in localStorage', () => {
    expect(getSoclaasApiKey()).toBe('');
    setSoclaasApiKey('test-key-123');
    expect(getSoclaasApiKey()).toBe('test-key-123');
    setSoclaasApiKey('');
    expect(getSoclaasApiKey()).toBe('');
  });

  it('gets and sets custom endpoint', () => {
    expect(getSoclaasEndpoint()).toBe('/api/soclaas');
    setSoclaasEndpoint('https://custom.endpoint/v1');
    expect(getSoclaasEndpoint()).toBe('https://custom.endpoint/v1');
    setSoclaasEndpoint('');
    expect(getSoclaasEndpoint()).toBe('/api/soclaas');
  });

  it('fails callSoclaasChat on 401 when API key is missing or invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Unauthorized',
    }));

    await expect(
      callSoclaasChat({
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow('SoCLaaS API key is missing');
  });

  it('successfully returns content on 200 response with server proxy key', async () => {
    // No client API key in localStorage
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"answer": "ok"}' } }],
      }),
    }));

    const result = await callSoclaasChat({
      messages: [{ role: 'user', content: 'test' }],
      responseFormat: 'json_object',
    });

    expect(result).toBe('{"answer": "ok"}');
    expect(fetch).toHaveBeenCalledWith(
      '/api/soclaas/chat/completions',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('tests connection with personal key and reports success', async () => {
    setSoclaasApiKey('valid-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }));

    const result = await testSoclaasConnection();
    expect(result.ok).toBe(true);
    expect(result.message).toContain('personal key');
  });

  it('tests connection with server key and reports success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }));

    const result = await testSoclaasConnection();
    expect(result.ok).toBe(true);
    expect(result.message).toContain('server proxy key');
  });

  it('tests connection and reports 401 unauthorized', async () => {
    setSoclaasApiKey('bad-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    }));

    const result = await testSoclaasConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('401');
  });
});
