/**
 * Serverless reverse proxy for SoCLaaS API (Vercel / Node.js).
 * Keeps SOCLAAS_API_KEY secure on the server side so students do not need their own key.
 */
export default async function handler(req, res) {
  // CORS Preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const serverKey = process.env.SOCLAAS_API_KEY;
  const clientAuth = req.headers.authorization;
  const authHeader = clientAuth || (serverKey ? `Bearer ${serverKey}` : null);

  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized: SOCLAAS_API_KEY is not configured on the server and no key was sent.',
    });
  }

  const url = new URL(req.url, 'http://localhost');
  const pathSuffix = url.pathname.replace(/^\/api\/soclaas/, '');
  const targetUrl = `https://soclaas-api.comp.nus.edu.sg/v1${pathSuffix || '/chat/completions'}${url.search}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const responseText = await upstream.text();
    res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
    return res.status(upstream.status).send(responseText);
  } catch (error) {
    return res.status(502).json({
      error: `Proxy error reaching SoCLaaS: ${error instanceof Error ? error.message : 'Unknown network failure'}`,
    });
  }
}
