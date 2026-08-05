// Paths waitlist. POST { email } stores it in a Vercel KV hash (unique by
// email). GET ?key=<LOG_SECRET> reads it back (JSON or ?format=csv). No npm
// deps; talks to the KV REST API with fetch. Called by /paths/ while Paths is
// not live yet.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.LOG_SECRET;
const KEY = 'gtm-waitlist';

function kv(command) {
  return fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  }).then((r) => r.json());
}
function csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }

export default async function handler(req, res) {
  // Read (gated).
  if (req.method === 'GET') {
    if (!SECRET || req.query.key !== SECRET) { res.status(401).json({ error: 'unauthorized', configured: !!SECRET }); return; }
    if (!KV_URL || !KV_TOKEN) { res.status(200).json({ error: 'store not configured' }); return; }
    const data = await kv(['HGETALL', KEY]);
    const arr = data.result || [];
    const items = [];
    for (let i = 0; i < arr.length; i += 2) items.push({ email: arr[i], ts: arr[i + 1] });
    items.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.status(200).send('email,ts\n' + items.map((i) => `${csvCell(i.email)},${csvCell(i.ts)}`).join('\n'));
      return;
    }
    res.status(200).json({ count: items.length, waitlist: items });
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { const p = new URLSearchParams(body); body = {}; p.forEach((v, k) => { body[k] = v; }); }
  }
  body = body || {};
  const wantsJson = (req.headers.accept || '').indexOf('application/json') > -1;
  function ok() {
    if (wantsJson) { res.status(200).json({ ok: true }); }
    else { res.statusCode = 303; res.setHeader('Location', '/paths/?joined=1'); res.end(); }
  }

  if (body['company-website']) { ok(); return; } // honeypot
  const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    if (wantsJson) { res.status(400).json({ ok: false }); }
    else { res.statusCode = 303; res.setHeader('Location', '/paths/'); res.end(); }
    return;
  }
  if (KV_URL && KV_TOKEN) { try { await kv(['HSET', KEY, email, new Date().toISOString()]); } catch (e) {} }
  ok();
}
