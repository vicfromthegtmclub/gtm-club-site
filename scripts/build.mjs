// Builds the whole GTM Club site into /dist as plain static HTML.
// Run: npm run build   (Netlify runs this automatically on every push)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { zipDir } from './zip.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SKILLS = path.join(ROOT, 'content/skills');
const EVENTS = path.join(ROOT, 'content/events');
const SITE = process.env.URL || 'https://gtmclub.netlify.app'; // Netlify sets URL at build time

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/data/site.json'), 'utf8'));

/* ---------------------------------------------------------------- parsing */

function parseFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["'](.*)["']$/, '$1')).filter(Boolean);
    }
    out[kv[1]] = v;
  }
  return { data: out, body: m[2] };
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pad2 = n => String(n).padStart(2, '0');

function relativeDate(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Small markdown renderer. Enough for SKILL.md: headings, lists, code, bold, links.
function markdown(src) {
  const blocks = [];
  src = src.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push(`<pre class="code"><code>${esc(code.replace(/\s+$/, ''))}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });

  const inline = t => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

  const out = [];
  let list = null;
  let para = [];
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closePara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flush = () => { closePara(); closeList(); };

  for (const line of src.split(/\r?\n/)) {
    const raw = line.trim();
    const ph = /^\u0000(\d+)\u0000$/.exec(raw);
    if (ph) { flush(); out.push(blocks[+ph[1]]); continue; }
    if (!raw) { flush(); continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(raw);
    if (h) { flush(); const l = Math.min(h[1].length + 1, 6); out.push(`<h${l}>${inline(h[2])}</h${l}>`); continue; }

    const ul = /^[-*]\s+(.*)$/.exec(raw);
    if (ul) { closePara(); if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(ul[1])}</li>`); continue; }

    const ol = /^\d+[.)]\s+(.*)$/.exec(raw);
    if (ol) { closePara(); if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(ol[1])}</li>`); continue; }

    closeList();
    para.push(raw);
  }
  flush();
  return out.join('\n');
}

/* ------------------------------------------------------------------ shell */

const NAV = [
  ['/', 'Manifesto'], ['/library/', 'Library'], ['/paths/', 'Paths'],
  ['/events/', 'Events'], ['/community/', 'Community'],
];

function layout({ title, description, body, canonical, current }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}${canonical}">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/logo-96.png">
<link rel="preload" href="/assets/fonts/druk-wide-bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/helvetica-now-text-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${CSS_HREF}">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="nav">
  <div class="nav-in">
    <a class="brand" href="/"><img src="/assets/logo-96.png" alt="" width="28" height="28"> GTM Club</a>
    <nav aria-label="Main">
      ${NAV.map(([href, label]) =>
        `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <nav class="foot-social" aria-label="Social links">
    ${(data.social || []).map(s =>
      `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('\n    ')}
  </nav>
  <p>GTM Club. Assets are shared by members, credited to their authors.</p>
</footer>
</body>
</html>`;
}

const hero = (eyebrow, h1, lede, cta) => `
<section class="hero">
  <div class="wrap">
    <p class="eyebrow">${esc(eyebrow)}</p>
    <h1>${esc(h1)}</h1>
    ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
    ${cta ? `<p class="hero-cta"><a class="btn btn-solid" href="${esc(cta.href)}">${esc(cta.label)}</a></p>` : ''}
  </div>
</section>`;

const sectionLabel = t => `<p class="section-label">${esc(t)}</p>`;

/* ------------------------------------------------------------ page: home */

function homePage() {
  const m = data.manifesto;
  const body = `
${hero('Manifesto', 'Learn. Share. Grow. Together.')}

<section class="band">
  <div class="wrap prose-wide">
    ${m.intro.map(p => `<p>${esc(p)}</p>`).join('\n    ')}
  </div>
</section>

<section class="band">
  <div class="wrap">
    ${sectionLabel('What we believe')}
    ${m.beliefs.map((b, i) => `<div class="belief">
      <span class="belief-n">${pad2(i + 1)}</span>
      <div>
        <h2 class="display-sm">${esc(b.title)}</h2>
        <p>${esc(b.body)}</p>
      </div>
    </div>`).join('\n    ')}
  </div>
</section>

<section class="band">
  <div class="wrap">
    ${sectionLabel('Who runs it')}
    <div class="cards-3">
      ${m.team.map(p => {
        const hasImg = p.img && fs.existsSync(path.join(ROOT, 'src', p.img));
        const avatar = hasImg
          ? `<img class="avatar" src="${esc(p.img)}" alt="" width="56" height="56" loading="lazy">`
          : `<span class="avatar avatar-mono" aria-hidden="true">${esc(p.initials || '')}</span>`;
        return `<a class="card-static hoverable team-card" href="${esc(p.url)}" target="_blank" rel="noopener">
        ${avatar}
        <p class="card-name">${esc(p.name)}</p>
        <p class="card-sub">${esc(p.role)}</p>
        ${p.note ? `<p class="card-note">${esc(p.note)}</p>` : ''}
      </a>`;
      }).join('\n      ')}
    </div>
  </div>
</section>

<section class="cta">
  <div class="wrap narrow">
    <div class="slashes"><i></i><i></i><i></i><i></i></div>
    <h2 class="display-lg">Come build with us.</h2>
    <p><a class="btn btn-solid" href="${esc(data.links.apply)}">Apply to join</a></p>
  </div>
</section>`;

  return layout({
    title: 'GTM Club. A small room for operators who ship',
    description: 'A community and hands-on paths for go-to-market operators. No gurus, no gated PDFs. Post the artifact, get a real answer.',
    canonical: '/', current: '/', body,
  });
}

/* ----------------------------------------------------------- page: paths */

function pathsPage() {
  const a = data.paths;
  const body = `
${hero('The courses', 'Learn the craft. On the job.', a.lede,
  { href: data.links.circle, label: 'Enter the courses' })}

<section class="band">
  <div class="wrap">
    ${sectionLabel('Tracks')}
    <div class="cards-4">
      ${a.tracks.map(t => `<div class="card-static hoverable">
        <span class="art">Track art</span>
        <h2 class="display-sm">${esc(t.name)}</h2>
        <p class="card-sub">${esc(t.blurb)}</p>
        <p class="dim">${esc(t.modules)} &middot; ${esc(t.level)}</p>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="row-head">
      <h2 class="display-md">Inside a track</h2>
      <span class="section-label">${esc(a.sampleTrack)}</span>
    </div>
    ${a.modules.map((m, i) => `<div class="row-item">
      <span class="row-n">${pad2(i + 1)}</span>
      <div>
        <p class="row-title">${esc(m.title)}</p>
        <p class="card-sub">${esc(m.out)}</p>
      </div>
      <span class="dim">${esc(m.len)}</span>
    </div>`).join('\n    ')}
  </div>
</section>

<section class="band">
  <div class="wrap cols-3">
    ${a.howItRuns.map(c => `<div>
      <h3 class="display-sm">${esc(c.title)}</h3>
      <p class="card-sub">${esc(c.body)}</p>
    </div>`).join('\n    ')}
  </div>
</section>

<section class="cta">
  <div class="wrap narrow">
    <h2 class="display-lg">Everything runs on Circle.</h2>
    <p class="lede center">Sessions, replays and workbooks live in one place. Members get access on day one.</p>
    <p><a class="btn btn-accent" href="${esc(data.links.circle)}">Go to Circle</a></p>
  </div>
</section>`;

  return layout({
    title: 'Paths. Live GTM courses taught by operators. GTM Club',
    description: 'Four live tracks on outbound, RevOps, pipeline math and AI for GTM. Every module ends with a working artifact.',
    canonical: '/paths/', current: '/paths/', body,
  });
}

/* ---------------------------------------------------------- page: events */

function eventsPage(events) {
  const body = `
${hero('Calendar', "What's on.", data.events.lede)}

<section class="band">
  <div class="wrap">
    ${events.length ? events.map(e => `<div class="row-item event">
      <div class="date">
        <span class="date-d">${esc(e.day)}</span>
        <span class="date-m">${esc(e.month)}</span>
      </div>
      <div>
        <p class="row-title">${esc(e.title)} <span class="pill sm">${esc(e.kind)}</span></p>
        <p class="card-sub">${esc(e.detail)}</p>
      </div>
      <a class="btn sm" href="${esc(e.link)}">Save my seat</a>
    </div>`).join('\n    ') : '<p class="empty">Nothing scheduled right now. Check back soon.</p>'}
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="row-head">
      <h2 class="display-md">Replays</h2>
      <span class="section-label">In the archive</span>
    </div>
    <div class="cards-4">
      ${data.events.replays.map(r => `<a class="replay" href="${esc(data.links.circle)}">
        <span class="art wide">Thumbnail</span>
        <p class="card-name">${esc(r.title)}</p>
        <p class="dim">${esc(r.meta)}</p>
      </a>`).join('\n      ')}
    </div>
  </div>
</section>`;

  return layout({
    title: 'Events. Teardowns, office hours and build nights. GTM Club',
    description: 'Live GTM teardowns, office hours, build nights and quarterly dinners. All times CET.',
    canonical: '/events/', current: '/events/', body,
  });
}

/* ------------------------------------------------------- page: community */

function communityPage() {
  const c = data.community;
  const body = `
${hero('The community', 'The room you post in first.', c.lede)}

<section class="band">
  <div class="wrap">
    ${sectionLabel('What you get')}
    <div class="cards-4">
      ${c.benefits.map(b => `<div class="card-static">
        <h2 class="card-name lg">${esc(b.title)}</h2>
        <p class="card-sub">${esc(b.body)}</p>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    ${sectionLabel("Who's inside")}
    <div class="pills">
      ${c.roles.map(r => `<span class="chip static">${esc(r)}</span>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    ${sectionLabel('How you get in')}
    <div class="cols-3">
      ${c.howToJoin.map((s, i) => `<div class="step${i === 0 ? ' first' : ''}">
        <h3 class="display-sm">${pad2(i + 1)} ${esc(s.title)}</h3>
        <p class="card-sub">${esc(s.body)}</p>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap narrow">
    <h2 class="display-md">House rules</h2>
    <ol class="rules">
      ${c.houseRules.map(r => `<li>${esc(r)}</li>`).join('\n      ')}
    </ol>
  </div>
</section>

<section class="cta">
  <div class="wrap narrow">
    <h2 class="display-lg">Apply to the club.</h2>
    <p class="lede center">Applications are reviewed every Friday. You'll hear back either way.</p>
    <p><a class="btn btn-accent" href="${esc(data.links.apply)}">Open the application</a></p>
  </div>
</section>`;

  return layout({
    title: 'Community. Operators who ship, split by motion. GTM Club',
    description: 'A curated GTM community: channels by motion, weekly teardowns, warm intros and numbers people actually share.',
    canonical: '/community/', current: '/community/', body,
  });
}

/* --------------------------------------------------------- page: library */

function card(a) {
  return `<a class="card" href="${a.url}" data-kind="${esc(a.kind)}" data-source="${esc(a.source)}">
  <div class="card-top">
    <span class="pill">${esc(a.kind)}</span>
    <span class="dim">${esc(a.updatedLabel)}</span>
  </div>
  <h3>${esc(a.title)}</h3>
  <p class="desc">${esc(a.description)}</p>
  <div class="card-foot">
    <span class="dim">${esc(a.meta)}</span>
    <span class="open">Open <span aria-hidden="true">↗</span></span>
  </div>
</a>`;
}

function libraryPage(assets, kinds, sources) {
  const chip = (facet, value, label, on) =>
    `<button type="button" class="chip${on ? ' is-on' : ''}" data-facet="${facet}" data-value="${esc(value)}" aria-pressed="${on}">${esc(label)}</button>`;
  const body = `
${hero('Asset library', 'Take it. Ship it today.',
  'Claude skills, repos, sequences, prompts and datasets built by members. Cloned, forked, credited.')}

<section class="filters">
  <div class="wrap filter-in">
    <div class="filter-group">
      <span class="filter-label">Type</span>
      <div class="pills" role="group" aria-label="Filter assets by type">
        ${['All', ...kinds].map((k, i) => chip('kind', k, k === 'All' ? 'All' : k + 's', i === 0)).join('\n        ')}
      </div>
    </div>
    <div class="filter-group">
      <span class="filter-label">Source</span>
      <div class="pills" role="group" aria-label="Filter assets by source">
        ${['All', ...sources].map((s, i) => chip('source', s, s, i === 0)).join('\n        ')}
      </div>
    </div>
    <span class="dim" id="count" aria-live="polite">${assets.length} assets</span>
  </div>
</section>

<section class="grid-wrap">
  <div class="wrap grid" id="grid">
    ${assets.map(card).join('\n    ')}
  </div>
  <p class="wrap empty" id="empty" hidden>Nothing here yet. Be the first to add one.</p>
</section>

<section class="cta">
  <div class="wrap narrow">
    <h2 class="display-md">Built something? Add it.</h2>
    <p class="lede center">Members submit assets straight from the club. Reviewed within a week, credited forever.</p>
    <p><a class="btn" href="/submit/">Submit an asset</a></p>
  </div>
</section>

<script src="${FILTER_JS_HREF}" defer></script>`;

  return layout({
    title: 'Asset library. Claude skills, sequences and prompts for GTM teams. GTM Club',
    description: 'Free Claude skills, repos, outbound sequences, prompts and datasets built by GTM Club members. Download and ship today.',
    canonical: '/library/', current: '/library/', body,
  });
}

function detailPage(a) {
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'CreativeWork',
    name: a.title, description: a.description, url: `${SITE}${a.url}`,
    dateModified: a.updated, genre: a.kind,
    ...(a.author ? { author: { '@type': 'Person', name: a.author } } : {}),
  };
  const body = `
<article class="detail wrap">
  <p class="crumb"><a href="/library/">Library</a> / ${esc(a.kind)}</p>
  <h1>${esc(a.title)}</h1>
  <p class="lede">${esc(a.description)}</p>
  <div class="detail-meta">
    <span class="pill">${esc(a.kind)}</span>
    ${a.author ? `<span class="dim">by ${esc(a.author)}</span>` : ''}
    <span class="dim">updated ${esc(a.updatedLabel)}</span>
  </div>
  <div class="actions">
    ${a.zip ? `<a class="btn btn-solid" href="${a.zip}" download>Download ${esc(a.slug)}.zip</a>` : ''}
    ${a.repo ? `<a class="btn" href="${esc(a.repo)}" rel="noopener">View source</a>` : ''}
  </div>
  <div class="prose">${a.html}</div>
  <p class="back"><a href="/library/">Back to the library</a></p>
</article>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`;

  return layout({
    title: `${a.title}. ${a.kind} for GTM teams. GTM Club`,
    description: a.description, canonical: a.url, current: '/library/', body,
  });
}

/* ---------------------------------------------------------- page: submit */

function submitPage(kinds) {
  const body = `
${hero('Submit', 'Add your asset.', 'One form. Reviewed within a week. Your name stays on it.')}
<section class="form-wrap">
  <div class="wrap narrow-form">
    <form name="asset" method="POST" data-netlify="true" netlify-honeypot="company-website" action="/submit/thanks/" enctype="multipart/form-data">
      <input type="hidden" name="form-name" value="asset">
      <p class="hp"><label>Leave this empty <input name="company-website" tabindex="-1" autocomplete="off"></label></p>

      <label for="title">Asset name</label>
      <input id="title" name="title" required maxlength="80" placeholder="Cold email refiner">

      <label for="kind">Type</label>
      <select id="kind" name="kind" required>
        ${kinds.map(k => `<option>${esc(k)}</option>`).join('\n        ')}
      </select>

      <label for="description">One line on what it does</label>
      <input id="description" name="description" required maxlength="160" placeholder="Audits a draft against 14 rules and rewrites what fails.">

      <label for="details">How you use it, and what it changed</label>
      <textarea id="details" name="details" rows="6" required placeholder="What problem it solves, who it is for, any numbers you have."></textarea>

      <label for="file">Upload the files <span class="dim">(zip, .md, csv. Optional if you paste a link)</span></label>
      <input id="file" name="file" type="file" accept=".zip,.md,.txt,.csv,.json">

      <label for="link">Or a link <span class="dim">(GitHub, Notion, Drive)</span></label>
      <input id="link" name="link" type="url" placeholder="https://github.com/you/your-skill">

      <label for="author">Your name, as it should appear</label>
      <input id="author" name="author" required maxlength="60">

      <label for="email">Email, so we can come back to you</label>
      <input id="email" name="email" type="email" required>

      <button class="btn btn-solid" type="submit">Submit asset</button>
    </form>
  </div>
</section>`;
  return layout({
    title: 'Submit an asset. GTM Club library',
    description: 'Share a Claude skill, sequence, prompt or dataset with the GTM Club library. Reviewed within a week, credited to you.',
    canonical: '/submit/', current: '/library/', body,
  });
}

function thanksPage() {
  return layout({
    title: 'Submission received. GTM Club',
    description: 'Your asset submission was received.',
    canonical: '/submit/thanks/', current: '/library/',
    body: `${hero('Received', 'Got it.', "We review submissions weekly. If it lands in the library you will get an email with the link, and your name on the page.")}
<section class="band"><div class="wrap"><a class="btn" href="/library/">Back to the library</a></div></section>`,
  });
}

/* ------------------------------------------------------------------ read */

function readAssets() {
  if (!fs.existsSync(SKILLS)) return [];
  return fs.readdirSync(SKILLS, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const dir = path.join(SKILLS, d.name);
      const file = ['SKILL.md', 'index.md'].map(f => path.join(dir, f)).find(fs.existsSync);
      if (!file) { console.warn(`  skipped ${d.name}: no SKILL.md`); return null; }
      const { data: fm, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      if (String(fm.draft) === 'true') return null;
      const updated = fm.updated || fs.statSync(file).mtime.toISOString().slice(0, 10);
      return {
        slug: d.name, dir,
        title: fm.title || fm.name || d.name,
        description: fm.description || '',
        kind: fm.kind || 'Skill',
        source: fm.source || 'Member',
        meta: fm.meta || '',
        author: fm.author || '',
        repo: fm.repo || '',
        // A Tool ships a self-contained tool.html that IS the detail page.
        tool: fs.existsSync(path.join(dir, 'tool.html')) ? path.join(dir, 'tool.html') : null,
        updated, updatedLabel: relativeDate(updated),
        url: `/library/${d.name}/`,
        html: markdown(body),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.updated.localeCompare(a.updated));
}

function readEvents() {
  if (!fs.existsSync(EVENTS)) return [];
  const today = new Date().toISOString().slice(0, 10);
  return fs.readdirSync(EVENTS)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const { data: fm } = parseFrontmatter(fs.readFileSync(path.join(EVENTS, f), 'utf8'));
      if (!fm.date) { console.warn(`  skipped ${f}: no date`); return null; }
      const d = new Date(fm.date + 'T12:00:00Z');
      return {
        date: fm.date,
        day: pad2(d.getUTCDate()),
        month: d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
        title: fm.title || f.replace(/\.md$/, ''),
        kind: fm.kind || 'Live',
        detail: fm.detail || '',
        link: fm.link || data.links.circle,
      };
    })
    .filter(e => e && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ----------------------------------------------------------------- write */

function zipSkill(a, outDir) {
  try {
    zipDir(a.dir, path.join(outDir, `${a.slug}.zip`));
    return `${a.url}${a.slug}.zip`;
  } catch (e) {
    console.warn(`  zip failed for ${a.slug}: ${e.message}`);
    return null;
  }
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

const write = (rel, html) => {
  const f = path.join(DIST, rel, 'index.html');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
};

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(ROOT, 'src/assets'), path.join(DIST, 'assets'));
copyDir(path.join(ROOT, 'src/static'), DIST);

// Content-hash the CSS and JS so a change ships under a new URL. Without this the
// filenames are stable, and the immutable cache header on /assets/* (vercel.json)
// pins the old file on returning visitors: new HTML runs against stale JS and the
// filters silently break. Hashed names make the immutable header correct instead.
function fingerprint(name) {
  const dir = path.join(DIST, 'assets');
  const buf = fs.readFileSync(path.join(dir, name));
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
  const ext = path.extname(name);
  const hashed = `${name.slice(0, -ext.length)}.${hash}${ext}`;
  fs.writeFileSync(path.join(dir, hashed), buf);
  fs.rmSync(path.join(dir, name)); // drop the un-fingerprinted copy so nothing stale ships
  return `/assets/${hashed}`;
}
const CSS_HREF = fingerprint('styles.css');
const FILTER_JS_HREF = fingerprint('filter.js');

const assets = readAssets();
const events = readEvents();
const kinds = [...new Set(assets.map(a => a.kind))].sort();
// Source facet: Member and Lemskills are always shown (pinned), even with zero
// skills, so the chips stay stable as the library fills in. Any future source
// value in the data is appended after them, alphabetically.
const SOURCE_ORDER = ['Member', 'Lemskills'];
const sources = [...new Set([...SOURCE_ORDER, ...assets.map(a => a.source)])].sort((a, b) =>
  ((SOURCE_ORDER.indexOf(a) + 1 || 99) - (SOURCE_ORDER.indexOf(b) + 1 || 99)) || a.localeCompare(b));
const kindOptions = [...new Set([...kinds, 'Skill', 'Repo', 'Tool', 'Sequence', 'Prompt', 'Dataset'])].sort();

for (const a of assets) {
  const outDir = path.join(DIST, 'library', a.slug);
  fs.mkdirSync(outDir, { recursive: true });
  if (a.tool) {
    // The tool page is self-contained; serve it verbatim as the detail page.
    fs.copyFileSync(a.tool, path.join(outDir, 'index.html'));
  } else {
    a.zip = zipSkill(a, outDir);
    fs.writeFileSync(path.join(outDir, 'index.html'), detailPage(a));
  }
}

write('.', homePage());
write('paths', pathsPage());
write('events', eventsPage(events));
write('community', communityPage());
write('library', libraryPage(assets, kinds, sources));
write('submit', submitPage(kindOptions));
write('submit/thanks', thanksPage());

fs.writeFileSync(path.join(DIST, 'assets/library.json'), JSON.stringify(
  assets.map(({ dir, html, ...rest }) => rest), null, 2));

const urls = ['/', '/library/', '/paths/', '/events/', '/community/', '/submit/', ...assets.map(a => a.url)];
fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${SITE}${u}</loc></url>`).join('\n') + `\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`Built 5 pages, ${assets.length} assets, ${events.length} upcoming events`);
