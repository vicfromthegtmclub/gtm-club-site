// oEmbed endpoint. Lets GTM Club tool pages embed as interactive iframes on
// platforms that unfurl via oEmbed (Circle, Notion, WordPress, etc.). Each tool
// page advertises this endpoint with
//   <link rel="alternate" type="application/json+oembed" href="/api/oembed?url=...">
// and the platform calls it to get the embed HTML.
//
// Only our own /library/<slug>/ tool pages are embeddable, so this can never be
// used as an open iframe proxy for arbitrary sites.
const SITE = 'https://www.thegtmclub.com';

// Per-tool title and a sensible default embed height (the result screens differ).
const TOOLS = {
  'one-signal-test': { title: 'The one signal test', height: 900 },
  'outbound-quota-calculator': { title: 'Outbound quota calculator', height: 900 },
  'pain-to-value-matrix': { title: 'Pain to value matrix', height: 1000 },
};

export default function handler(req, res) {
  const q = req.query || {};
  let slug, target;
  try {
    const u = new URL(q.url || '');
    const m = u.pathname.match(/^\/library\/([a-z0-9-]+)\/?$/);
    if (u.origin !== new URL(SITE).origin || !m) {
      res.status(404).json({ error: 'not embeddable' });
      return;
    }
    slug = m[1];
    target = `${SITE}/library/${slug}/`;
  } catch {
    res.status(400).json({ error: 'bad url' });
    return;
  }

  const tool = TOOLS[slug] || { title: 'GTM Club', height: 900 };
  const width = Math.min(parseInt(q.maxwidth, 10) || 640, 1200);
  const height = Math.min(parseInt(q.maxheight, 10) || tool.height, 2000);
  const html =
    `<iframe src="${target}" width="${width}" height="${height}" ` +
    `style="border:0;border-radius:14px;max-width:100%" ` +
    `loading="lazy" title="${tool.title}" allow="clipboard-write"></iframe>`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({
    version: '1.0',
    type: 'rich',
    provider_name: 'GTM Club',
    provider_url: SITE,
    title: tool.title,
    width,
    height,
    html,
  });
}
