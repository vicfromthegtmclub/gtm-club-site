// Returns the stored /submit/ submissions (oldest first). Gated by
// ?key=<LOG_SECRET>. Add ?format=csv for a spreadsheet-friendly dump.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.LOG_SECRET;
const KEY = 'gtm-submissions';
const COLS = ['ts', 'title', 'kind', 'author', 'email', 'description', 'link', 'details'];

function kv(command) {
  return fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  }).then((r) => r.json());
}

function csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }

export default async function handler(req, res) {
  if (!SECRET || req.query.key !== SECRET) { res.status(401).json({ error: 'unauthorized', configured: !!SECRET }); return; }
  if (!KV_URL || !KV_TOKEN) { res.status(200).json({ error: 'store not configured' }); return; }
  const data = await kv(['LRANGE', KEY, '0', '-1']);
  const items = (data.result || []).map((s) => { try { return JSON.parse(s); } catch (e) { return { raw: s }; } });
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    const rows = [COLS.join(',')].concat(items.map((it) => COLS.map((c) => csvCell(it[c])).join(',')));
    res.status(200).send(rows.join('\n'));
    return;
  }
  res.status(200).json({ count: items.length, submissions: items });
}
