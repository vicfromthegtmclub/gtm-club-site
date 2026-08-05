// Stores an asset submission from /submit/ into Vercel KV (Upstash Redis) via the
// REST API, no npm deps. Accepts a native urlencoded form POST, so it works with
// JS off: store, then 303-redirect to the thank-you page. Reads live in
// api/submissions.js, behind ?key=<LOG_SECRET>.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'gtm-submissions';
const MAX = 5000;

function kv(command) {
  return fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  }).then((r) => r.json());
}

function field(body, name) {
  const v = body && body[name];
  return (v == null ? '' : String(v)).slice(0, 4000).trim();
}

function thanks(res) {
  res.statusCode = 303;
  res.setHeader('Location', '/submit/thanks/');
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  let body = req.body;
  if (typeof body === 'string') {
    const p = new URLSearchParams(body); body = {}; p.forEach((v, k) => { body[k] = v; });
  }
  body = body || {};

  // Honeypot: bots fill it. Accept the request so they get no signal, but store nothing.
  if (field(body, 'company-website')) { thanks(res); return; }

  const entry = {
    title: field(body, 'title'),
    kind: field(body, 'kind'),
    description: field(body, 'description'),
    details: field(body, 'details'),
    link: field(body, 'link'),
    author: field(body, 'author'),
    email: field(body, 'email'),
    ts: new Date().toISOString(),
  };
  if (!entry.title || !entry.email) { res.status(400).json({ ok: false, error: 'missing fields' }); return; }

  if (KV_URL && KV_TOKEN) {
    try { await kv(['RPUSH', KEY, JSON.stringify(entry)]); await kv(['LTRIM', KEY, -MAX, -1]); } catch (e) {}
  }
  thanks(res);
}
