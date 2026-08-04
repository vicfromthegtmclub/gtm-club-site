// Returns the logged domains (oldest first). Gated by ?key=<LOG_SECRET> so the
// list is not public. Add ?format=csv for a spreadsheet-friendly dump.
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const SECRET = process.env.LOG_SECRET;
const KEY = 'gtm-domains';

function kv(command) {
  return fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  }).then((r) => r.json());
}

export default async function handler(req, res) {
  if (!SECRET || req.query.key !== SECRET) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (!KV_URL || !KV_TOKEN) { res.status(200).json({ error: 'store not configured' }); return; }
  const data = await kv(['LRANGE', KEY, '0', '-1']);
  const items = (data.result || []).map((s) => { try { return JSON.parse(s); } catch { return { raw: s }; } });
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.status(200).send('domain,ts\n' + items.map((i) => `${i.domain || ''},${i.ts || ''}`).join('\n'));
    return;
  }
  res.status(200).json({ count: items.length, domains: items });
}
