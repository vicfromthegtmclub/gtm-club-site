// Logs the domain a visitor generates an AI prompt for, from the pain-to-value
// matrix tool. Talks to the Vercel KV (Upstash Redis) REST API with fetch only,
// so the function has no npm dependencies. It is called fire-and-forget from the
// client and always answers 200, so a missing store or a junk input never
// surfaces an error in the browser. Reads live in api/domains.js, behind a secret.
// Accept either the Vercel KV or the Upstash Marketplace env var names.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'gtm-domains';
const MAX = 5000; // keep the list bounded

function kv(command) {
  return fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  }).then((r) => r.json());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  if (!KV_URL || !KV_TOKEN) { res.status(200).json({ ok: false, note: 'store not configured' }); return; }
  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const raw = (body && body.domain ? String(body.domain) : '').trim().toLowerCase();
    const domain = raw.replace(/^https?:\/\//, '').split('/')[0].split('?')[0].slice(0, 120);
    // Only store things that actually look like a domain (label.tld), to keep junk out.
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) { res.status(200).json({ ok: false }); return; }
    const entry = JSON.stringify({ domain, ts: new Date().toISOString() });
    await kv(['RPUSH', KEY, entry]);
    await kv(['LTRIM', KEY, -MAX, -1]);
    res.status(200).json({ ok: true });
  } catch {
    res.status(200).json({ ok: false });
  }
}
