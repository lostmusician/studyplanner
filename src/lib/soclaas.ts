export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SoclaasChatOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
}

const STORAGE_KEY_API_KEY = 'soclaas:apiKey';
const STORAGE_KEY_ENDPOINT = 'soclaas:endpoint';
const DEFAULT_MODEL = 'x-test-2';
const DEFAULT_ENDPOINT = '/api/soclaas';

export const getSoclaasApiKey = (): string => {
  if (typeof localStorage === 'undefined') return '';
  const stored = localStorage.getItem(STORAGE_KEY_API_KEY);
  if (stored && stored.trim().length > 0) return stored.trim();
  const envKey = (import.meta as unknown as { env?: { VITE_SOCLAAS_API_KEY?: string } }).env?.VITE_SOCLAAS_API_KEY;
  return envKey ? envKey.trim() : '';
};

export const setSoclaasApiKey = (key: string): void => {
  if (typeof localStorage === 'undefined') return;
  const cleaned = key.trim();
  if (cleaned.length === 0) {
    localStorage.removeItem(STORAGE_KEY_API_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY_API_KEY, cleaned);
  }
};

export const getSoclaasEndpoint = (): string => {
  if (typeof localStorage === 'undefined') return DEFAULT_ENDPOINT;
  return localStorage.getItem(STORAGE_KEY_ENDPOINT)?.trim() || DEFAULT_ENDPOINT;
};

export const setSoclaasEndpoint = (endpoint: string): void => {
  if (typeof localStorage === 'undefined') return;
  const cleaned = endpoint.trim();
  if (!cleaned || cleaned === DEFAULT_ENDPOINT) {
    localStorage.removeItem(STORAGE_KEY_ENDPOINT);
  } else {
    localStorage.setItem(STORAGE_KEY_ENDPOINT, cleaned);
  }
};

export const testSoclaasConnection = async (): Promise<{ ok: boolean; message: string }> => {
  const apiKey = getSoclaasApiKey();
  const endpoint = getSoclaasEndpoint();
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(`${endpoint}/models`, { headers });
    if (response.status === 401) {
      return {
        ok: false,
        message: apiKey
          ? 'Invalid personal API key (401 Unauthorized).'
          : 'No server-side key configured and no personal key provided.',
      };
    }
    if (!response.ok) {
      return { ok: false, message: `Server error (${response.status} ${response.statusText}).` };
    }
    return {
      ok: true,
      message: apiKey
        ? 'Successfully connected to SoCLaaS API (personal key)!'
        : 'Successfully connected to SoCLaaS API (server proxy key)!',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Network error connecting to SoCLaaS.',
    };
  }
};

export const callSoclaasChat = async (options: SoclaasChatOptions): Promise<string> => {
  const apiKey = getSoclaasApiKey();
  const endpoint = getSoclaasEndpoint();
  const body: Record<string, unknown> = {
    model: options.model ?? DEFAULT_MODEL,
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
  };

  if (options.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    throw new Error(
      apiKey
        ? 'Unauthorized: Invalid SoCLaaS API key in Settings.'
        : 'SoCLaaS API key is missing. Set SOCLAAS_API_KEY on the server or enter a key in Settings.',
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SoCLaaS API request failed (${response.status}): ${text || response.statusText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Received empty response from SoCLaaS API.');
  }

  return content;
};
