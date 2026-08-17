// "Notify me" for upcoming courses. POST { email, course } stores it in a KV
// hash keyed by `email|course` (unique per person per course). GET ?key=<LOG_SECRET>
// reads it back with a per-course count, so you can see where the hype is
// (JSON, or ?format=csv). No npm deps; talks to the KV REST API with fetch.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.LOG_SECRET;
const KEY = 'gtm-notify';

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
    for (let i = 0; i < arr.length; i += 2) {
      const f = arr[i]; const sep = f.indexOf('|');
      items.push({ email: sep > -1 ? f.slice(0, sep) : f, course: sep > -1 ? f.slice(sep + 1) : '', ts: arr[i + 1] });
    }
    items.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    const byCourse = {};
    items.forEach((i) => { byCourse[i.course] = (byCourse[i.course] || 0) + 1; });
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.status(200).send('email,course,ts\n' + items.map((i) => `${csvCell(i.email)},${csvCell(i.course)},${csvCell(i.ts)}`).join('\n'));
      return;
    }
    res.status(200).json({ count: items.length, byCourse, items });
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { const p = new URLSearchParams(body); body = {}; p.forEach((v, k) => { body[k] = v; }); }
  }
  body = body || {};
  const wantsJson = (req.headers.accept || '').indexOf('application/json') > -1;
  const back = req.headers.referer || '/paths/';
  function ok() {
    if (wantsJson) { res.status(200).json({ ok: true }); }
    else { res.statusCode = 303; res.setHeader('Location', back); res.end(); }
  }

  if (body['company-website']) { ok(); return; } // honeypot
  const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
  const course = String(body.course || '').trim().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    if (wantsJson) { res.status(400).json({ ok: false }); }
    else { res.statusCode = 303; res.setHeader('Location', back); res.end(); }
    return;
  }
  if (KV_URL && KV_TOKEN) { try { await kv(['HSET', KEY, `${email}|${course}`, new Date().toISOString()]); } catch (e) {} }
  ok();
}
