/**
 * Serverless reverse proxy for SoCLaaS API (Vercel / Node.js).
 * Keeps SOCLAAS_API_KEY secure on the server side so students do not need their own key.
 */

// Allow up to 60 seconds on Vercel for LLM inference
export const maxDuration = 60;

export default async function handler(req, res) {
  // CORS Preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const serverKey = process.env.SOCLAAS_API_KEY;
  if (!serverKey || !serverKey.trim()) {
    console.error('SOCLAAS_API_KEY is not configured in Vercel environment variables.');
    return res.status(500).json({
      error: 'SOCLAAS_API_KEY is not configured in Vercel environment variables.',
    });
  }

  // Sanitize key (strip Bearer prefix and wrapping quotes if pasted with them)
  const cleanKey = serverKey.trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '');
  const authHeader = `Bearer ${cleanKey}`;

  const url = new URL(req.url, 'http://localhost');
  let pathSuffix = url.pathname.replace(/^\/api\/soclaas\/?/, '');

  // If matched via catch-all [...path], resolve path from req.query
  if (!pathSuffix && req.query && req.query.path) {
    pathSuffix = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path);
  }

  const resolvedPath = pathSuffix
    ? pathSuffix.startsWith('/')
      ? pathSuffix
      : `/${pathSuffix}`
    : '/chat/completions';

  const targetUrl = `https://soclaas-api.comp.nus.edu.sg/v1${resolvedPath}${url.search}`;

  // Robust body handling: prevent double-stringification
  let bodyPayload = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (typeof req.body === 'string') {
      bodyPayload = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      bodyPayload = req.body.toString('utf-8');
    } else if (typeof req.body === 'object' && req.body !== null) {
      bodyPayload = JSON.stringify(req.body);
    }
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: bodyPayload,
    });

    const responseText = await upstream.text();
    res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
    return res.status(upstream.status).send(responseText);
  } catch (error) {
    console.error('Proxy error reaching SoCLaaS:', error);
    return res.status(502).json({
      error: `Proxy error reaching SoCLaaS: ${error instanceof Error ? error.message : 'Unknown network failure'}`,
    });
  }
}
