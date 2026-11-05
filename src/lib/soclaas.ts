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

const STORAGE_KEY_ENDPOINT = 'soclaas:endpoint';
const DEFAULT_MODEL = 'x-test-2';
const DEFAULT_ENDPOINT = '/api/soclaas';

/**
 * Client-side API key methods (deprecated; keys are strictly handled via server environment variables).
 */
export const getSoclaasApiKey = (): string => '';
export const setSoclaasApiKey = (_key: string): void => {};

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
  const endpoint = getSoclaasEndpoint();
  try {
    const response = await fetch(`${endpoint}/models`);
    if (response.status === 401) {
      return {
        ok: false,
        message: 'Unauthorized: SOCLAAS_API_KEY is not configured or is invalid in server environment variables.',
      };
    }
    if (!response.ok) {
      return { ok: false, message: `Server error (${response.status} ${response.statusText}).` };
    }
    return {
      ok: true,
      message: 'Successfully connected to SoCLaaS API.',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Network error connecting to SoCLaaS.',
    };
  }
};

export const callSoclaasChat = async (options: SoclaasChatOptions): Promise<string> => {
  const endpoint = getSoclaasEndpoint();
  const body: Record<string, unknown> = {
    model: options.model ?? DEFAULT_MODEL,
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
  };

  if (options.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const primaryUrl = endpoint.endsWith('/chat/completions')
    ? endpoint
    : `${endpoint}/chat/completions`;

  let response = await fetch(primaryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // If subpath returned 404 (common on hosts without catch-all rewrites), retry root endpoint directly
  if (response.status === 404 && primaryUrl !== endpoint) {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  if (response.status === 401) {
    throw new Error('SoCLaaS API key is missing or invalid in server environment variables.');
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
