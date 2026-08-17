// Builds the whole GTM Club site into /dist as plain static HTML.
// Run: npm run build   (Vercel runs this automatically on every push)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { zipDir } from './zip.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SKILLS = path.join(ROOT, 'content/skills');
const EVENTS = path.join(ROOT, 'content/events');
const SITE = process.env.SITE_URL || 'https://www.thegtmclub.com'; // canonical/og/sitemap base; override with SITE_URL

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/data/site.json'), 'utf8'));
// Course catalogue snapshot from Circle (see content/data/circle-courses.json).
// A sync script would regenerate this from the Circle Admin API before a build.
const circle = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/data/circle-courses.json'), 'utf8'));

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

function layout({ title, description, body, canonical, current, noindex }) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<script>(function(){try{if(localStorage.getItem('gtm-theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}})();</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex,nofollow">\n' : ''}<link rel="canonical" href="${SITE}${canonical}">
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
    <nav id="navMenu" aria-label="Main">
      ${NAV.map(([href, label]) =>
        `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
    </nav>
    <button class="theme-toggle" id="themeToggle" type="button" aria-label="Switch to light theme">Light</button>
    <button class="nav-toggle" id="navToggle" type="button" aria-label="Menu" aria-controls="navMenu" aria-expanded="false"><span></span><span></span><span></span></button>
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
<div class="shipbar" id="shipbar" hidden>
  <span class="shipbar-label" id="shipbarLabel">Time spent not shipping</span>
  <span class="shipbar-track"><i class="shipbar-fill" id="shipbarFill"></i></span>
  <a class="shipbar-cta" id="shipbarCta" href="/library/" hidden>Go ship &rarr;</a>
  <button class="shipbar-x" id="shipbarX" type="button" aria-label="Dismiss the nudge">&times;</button>
</div>
<script src="${THEME_JS_HREF}" defer></script>
</body>
</html>`;
}

const hero = (eyebrow, h1, lede, cta, opts = {}) => `
<section class="hero${opts.bg ? ' hero-bg' : ''}">
  ${opts.bg === 'aurora' ? '<div class="hero-aurora" aria-hidden="true"><span></span><span></span><span></span><span></span></div><div class="hero-scrim" aria-hidden="true"></div>' : opts.bg === 'video' ? '<video class="hero-video" autoplay muted loop playsinline preload="metadata" poster="/assets/hero-poster.jpg" aria-hidden="true"><source src="/assets/hero-reel.webm" type="video/webm"><source src="/assets/hero-reel.mp4" type="video/mp4"></video><div class="hero-scrim" aria-hidden="true"></div>' : ''}
  <div class="wrap">
    <p class="eyebrow">${esc(eyebrow)}</p>
    <h1>${esc(h1)}</h1>
    ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
    ${cta ? `<p class="hero-cta"><a class="btn btn-solid" href="${esc(cta.href)}">${esc(cta.label)}</a></p>` : ''}
  </div>${lede ? `
  <script>/* cap the lede to the title's widest wrapped line, so it ends where the title does */
(function(){var s=document.currentScript,h=s.closest('.hero'),t=h.querySelector('h1'),l=h.querySelector('.lede');if(!t||!l)return;
function fit(){var r=document.createRange();r.selectNodeContents(t);var m=0,c=r.getClientRects();for(var i=0;i<c.length;i++)if(c[i].width>m)m=c[i].width;l.style.maxWidth=Math.ceil(m)+'px';}
if(document.fonts&&document.fonts.ready){document.fonts.ready.then(fit);}else{fit();}
var to;addEventListener('resize',function(){clearTimeout(to);to=setTimeout(fit,120);});})();</script>` : ''}
</section>`;

const sectionLabel = t => `<p class="section-label">${esc(t)}</p>`;

/* ------------------------------------------------------------ page: home */

function homePage(assetCount) {
  const m = data.manifesto;
  const body = `
<section class="hero-cockpit">
  <div class="wrap cockpit-content">
    <p class="eyebrow">A higher standard of GTM motion</p>
    <h1><span class="line"><span>Learn. Share.</span></span><span class="line"><span>Grow. Together.</span></span></h1>
    <p class="lede">A small room of operators who ship, with the assets, paths and people to move faster than the feed.</p>
    <div class="hero-cta cockpit-cta">
      <a class="btn btn-solid" href="${esc(data.links.apply)}">Apply to join</a>
      <a class="btn" href="/library/">Browse the library</a>
    </div>
    <p class="cockpit-stats">${assetCount} free assets &nbsp;&middot;&nbsp; 30-seat rooms &nbsp;&middot;&nbsp; weekly teardowns</p>
  </div>

  <div class="cockpit-stage" aria-hidden="true">
    <div class="mock mock-chart">
      <div class="mock-top">
        <div><span class="mock-k">Reply rate</span><span class="mock-sub">Signal-led outbound</span></div>
        <span class="mock-tag">Live</span>
      </div>
      <div class="spark-wrap">
        <svg class="spark" viewBox="0 0 640 200" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sparkLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#CB3D00" stop-opacity=".2"/>
              <stop offset=".65" stop-color="#CB3D00"/>
              <stop offset="1" stop-color="#FF8A4C"/>
            </linearGradient>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#CB3D00" stop-opacity=".26"/>
              <stop offset="1" stop-color="#CB3D00" stop-opacity="0"/>
            </linearGradient>
            <filter id="sparkGlow" x="-15%" y="-80%" width="130%" height="260%">
              <feGaussianBlur stdDeviation="7"/>
            </filter>
          </defs>
          <g class="spark-grid"><line x1="0" y1="50" x2="640" y2="50"/><line x1="0" y1="100" x2="640" y2="100"/><line x1="0" y1="150" x2="640" y2="150"/></g>
          <path class="spark-area" d="M0,164 L40,156 L80,168 L120,144 L160,158 L200,126 L240,138 L280,108 L320,120 L360,88 L400,100 L440,66 L480,78 L520,44 L560,58 L600,26 L632,16 L632,200 L0,200 Z" fill="url(#sparkFill)"/>
          <path class="spark-glow" pathLength="1" d="M0,164 L40,156 L80,168 L120,144 L160,158 L200,126 L240,138 L280,108 L320,120 L360,88 L400,100 L440,66 L480,78 L520,44 L560,58 L600,26 L632,16" fill="none" stroke="#CB3D00" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" filter="url(#sparkGlow)" opacity=".85"/>
          <path class="spark-line" pathLength="1" d="M0,164 L40,156 L80,168 L120,144 L160,158 L200,126 L240,138 L280,108 L320,120 L360,88 L400,100 L440,66 L480,78 L520,44 L560,58 L600,26 L632,16" fill="none" stroke="url(#sparkLine)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle class="spark-tip" cx="632" cy="16" r="4.5" fill="#FF8A4C" filter="url(#sparkGlow)"/>
        </svg>
      </div>
      <div class="mock-axis"><span>W1</span><span>W2</span><span>W3</span><span>W4</span><span>W5</span><span>W6</span></div>
    </div>
    <div class="mock mock-list">
      <div class="mock-top"><span class="mock-k">Latest in the library</span><span class="mock-tag ghost">${assetCount}</span></div>
      <ul>
        <li><span><b>The one signal test</b><i>Interactive diagnostic</i></span><em>Tool</em></li>
        <li><span><b>Pain to value matrix</b><i>Messaging builder</i></span><em>Tool</em></li>
        <li><span><b>Warm intro finder</b><i>Network play</i></span><em>Skill</em></li>
        <li><span><b>Outbound quota calculator</b><i>Daily math</i></span><em>Tool</em></li>
      </ul>
    </div>
  </div>
</section>

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

function pathsPage(opts = {}) {
  const course = circle.courses[0];
  const enter = course ? course.url : data.links.circle;
  const howItRuns = [
    { title: 'Self-paced', body: 'Short lessons you watch on your schedule, then come back when you have shipped something.' },
    { title: 'In public', body: 'Every module ends in the community thread. Post your work, get it pulled apart by operators.' },
    { title: 'One artifact', body: 'You finish with a live signal agent running, not a certificate. The deliverable is real pipeline.' },
  ];
  const body = `
${hero('The courses', 'Learn the craft. On the job.',
  'Self-paced courses taught by operators who run the motion, not retired gurus. You leave with a working artifact, not notes.',
  { href: enter, label: 'Enter the courses' }, { bg: 'video' })}

<section class="band">
  <div class="wrap">
    ${sectionLabel('Courses')}
    <div class="cards-4">
      ${circle.courses.map(c => `<a class="card-static hoverable path-card" href="${esc(c.url)}" target="_blank" rel="noopener">
        <span class="path-emoji">${esc(c.emoji || '')}</span>
        <h2 class="display-sm">${esc(c.name)}</h2>
        <p class="card-sub">${esc(c.summary)}</p>
        <p class="dim">${c.modules.length} ${esc(c.sectionLabel)}s &middot; ${esc(c.courseType)}</p>
        ${c.stat ? `<p class="path-stat">${esc(c.stat)}</p>` : ''}
      </a>`).join('\n      ')}
      ${(circle.comingSoon || []).map(s => `<div class="card-static path-card is-soon">
        <span class="path-emoji">+</span>
        <h2 class="display-sm">${esc(s.title)}</h2>
        <p class="card-sub">${esc(s.summary)}</p>
        <p class="dim path-soon-label">Coming soon</p>
        <form class="path-notify" method="POST" action="/api/notify/">
          <input type="hidden" name="course" value="${esc(s.title)}">
          <input class="hp" type="text" name="company-website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <input type="email" name="email" required placeholder="Email me when it ships" aria-label="Notify me about ${esc(s.title)}">
          <button class="btn sm btn-solid" type="submit">Notify me</button>
          <p class="path-notify-done" hidden>On the list &check;</p>
        </form>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>

${course ? `
<section class="band">
  <div class="wrap">
    <div class="row-head">
      <h2 class="display-md">Inside the course</h2>
      <span class="section-label">${esc(course.emoji || '')} ${esc(course.name)}</span>
    </div>
    ${course.modules.map((m, i) => `<a class="row-item row-link" href="${esc(m.url || course.url)}" target="_blank" rel="noopener">
      <span class="row-n">${pad2(i)}</span>
      <div>
        <p class="row-title">${esc(m.title)}</p>
        <p class="card-sub">${esc(m.summary)}</p>
      </div>
      <span class="dim">${esc(m.label)}</span>
    </a>`).join('\n    ')}
  </div>
</section>` : ''}

<section class="band">
  <div class="wrap cols-3">
    ${howItRuns.map(c => `<div>
      <h3 class="display-sm">${esc(c.title)}</h3>
      <p class="card-sub">${esc(c.body)}</p>
    </div>`).join('\n    ')}
  </div>
</section>

<section class="cta">
  <div class="wrap narrow">
    <h2 class="display-lg">Everything runs on Circle.</h2>
    <p class="lede center">Lessons, discussion and your workbook live in one place. Members get access on day one.</p>
    <p><a class="btn btn-accent" href="${esc(enter)}">Go to Circle</a></p>
  </div>
</section>
<script>
(function(){
  document.querySelectorAll('form.path-notify').forEach(function(f){
    f.addEventListener('submit',function(e){
      e.preventDefault();
      var em=f.querySelector('input[name=email]'); var email=(em&&em.value||'').trim(); if(!email)return;
      var course=(f.querySelector('input[name=course]')||{}).value||'';
      var hp=(f.querySelector('input[name="company-website"]')||{}).value||'';
      fetch('/api/notify/',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({email:email,course:course,'company-website':hp})}).catch(function(){});
      if(em)em.hidden=true; var b=f.querySelector('button'); if(b)b.hidden=true;
      var d=f.querySelector('.path-notify-done'); if(d)d.hidden=false;
    });
  });
})();
</script>`;

  return layout({
    title: 'Paths. Self-paced GTM courses taught by operators. GTM Club',
    description: 'Self-paced GTM courses on Circle. The first: AI Signal-Driven Outbound, eight modules ending in a live signal agent.',
    canonical: opts.canonical || '/paths/',
    current: opts.current === undefined ? '/paths/' : opts.current,
    noindex: opts.noindex || false,
    body,
  });
}

// Shown at /paths/ until PATHS_LIVE is true. The full pathsPage() above is kept
// intact for when the tracks launch; flip the flag near the write() call to swap.
function pathsWaitlistPage() {
  const body = `
${hero('Paths', 'Coming soon.',
  'Live GTM courses taught by operators, each one ending with a working artifact you keep. We are building the first tracks now. Join the waitlist and we will email you the moment they open.',
  null, { bg: 'video' })}

<section class="band">
  <div class="wrap">
    <form class="waitlist" method="POST" action="/api/waitlist">
      <p class="hp"><label>Leave this empty <input name="company-website" tabindex="-1" autocomplete="off"></label></p>
      <input type="email" name="email" required placeholder="you@company.com" aria-label="Your email">
      <button class="btn btn-solid" type="submit">Join the waitlist</button>
    </form>
    <p class="waitlist-done" id="waitlistDone" hidden>You are on the list. We will email you when Paths goes live.</p>
    <p class="waitlist-note">One email when it launches. Nothing else.</p>
  </div>
</section>
<script>
(function(){
  var f=document.querySelector('.waitlist'), done=document.getElementById('waitlistDone');
  function ok(){ if(f){f.hidden=true;} if(done){done.hidden=false;} }
  if(new URLSearchParams(location.search).get('joined')){ ok(); history.replaceState(null,'',location.pathname); }
  if(f){ f.addEventListener('submit',function(e){
    e.preventDefault();
    var email=(f.querySelector('input[name=email]').value||'').trim();
    if(!email){ return; }
    var hp=(f.querySelector('input[name="company-website"]').value||'');
    fetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({email:email,'company-website':hp})}).catch(function(){});
    ok();
  }); }
})();
</script>`;
  return layout({
    title: 'Paths are coming. GTM Club',
    description: 'Live GTM courses taught by operators. Join the waitlist and we will email you when Paths goes live.',
    canonical: '/paths/', current: '/paths/', body,
  });
}

/* ---------------------------------------------------------- page: events */

function eventsPage(events) {
  const body = `
${hero('Calendar', "What's on.", data.events.lede, null, { bg: 'aurora' })}

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
${hero('The community', 'The room you post in first.', c.lede, null, { bg: 'aurora' })}

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

// Electric-border colours (GTM Club palette), warm brand tones first. Assigned
// round-robin by card position so all six appear evenly, stable across builds.
const EB_COLORS = ['#CB3D00', '#FF7A5A', '#9E2F00', '#6F7BB0', '#1E6E7A', '#C9A489'];

function card(a, i = 0) {
  const search = esc([a.title, a.description, a.kind, a.source, a.author, a.meta].join(' ').toLowerCase());
  return `<a class="card" href="${a.url}" data-kind="${esc(a.kind)}" data-source="${esc(a.source)}" data-search="${search}" style="--eb-color:${EB_COLORS[i % EB_COLORS.length]}">
  <span class="eb" aria-hidden="true"><i class="eb-bg"></i><i class="eb-stroke"></i><i class="eb-glow eb-g1"></i><i class="eb-glow eb-g2"></i></span>
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
<svg class="eb-defs" aria-hidden="true" width="0" height="0"><defs>
  <filter id="eb" color-interpolation-filters="sRGB" x="-30%" y="-30%" width="160%" height="160%">
    <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="8" seed="3" result="n1"/>
    <feOffset in="n1" dy="0" result="o1"><animate attributeName="dy" values="260;0" dur="3.2s" repeatCount="indefinite" calcMode="linear"/></feOffset>
    <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="8" seed="3" result="n2"/>
    <feOffset in="n2" dy="0" result="o2"><animate attributeName="dy" values="0;-260" dur="3.2s" repeatCount="indefinite" calcMode="linear"/></feOffset>
    <feComposite in="o1" in2="o2" result="noise"/>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="16" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</defs></svg>
${hero('Asset library', 'Take it. Ship it today.',
  'Claude skills, repos, sequences, prompts and datasets built by members. Cloned, forked, credited.',
  null, { bg: 'aurora' })}

<section class="filters">
  <div class="wrap">
    <div class="searchrow">
      <input type="search" id="q" class="search-input" placeholder="Search the library"
        aria-label="Search the library" autocomplete="off" spellcheck="false">
      <p class="searchhint">Add words to narrow it down. Each one filters further, and common synonyms work too.</p>
      <script type="application/json" id="synonyms">${JSON.stringify(data.searchSynonyms || {})}</script>
    </div>
    <div class="filter-in">
      <div class="filter-group">
        <span class="filter-label">Type</span>
        <div class="pills" role="group" aria-label="Filter assets by type">
          ${['All', ...kinds].map((k, i) => chip('kind', k, k === 'All' ? 'All' : k + 's', i === 0)).join('\n          ')}
        </div>
      </div>
      <div class="filter-group">
        <span class="filter-label">Source</span>
        <div class="pills" role="group" aria-label="Filter assets by source">
          ${['All', ...sources].map((s, i) => chip('source', s, s, i === 0)).join('\n          ')}
        </div>
      </div>
      <span class="dim" id="count" aria-live="polite">${assets.length} assets</span>
    </div>
  </div>
</section>

<section class="grid-wrap">
  <div class="wrap grid" id="grid">
    ${assets.map(card).join('\n    ')}
  </div>
  <p class="wrap empty" id="empty" hidden>No matches. Try fewer words, or clear a filter.</p>
</section>

<section class="cta">
  <div class="wrap narrow">
    <h2 class="display-md">Built something? Add it.</h2>
    <p class="lede center">Members submit assets straight from the club. Reviewed within a week, credited forever. Every skill also lives on GitHub, clone it, fork it, star it.</p>
    <p style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><a class="btn" href="/submit/">Submit an asset</a>${data.links.skillsRepo ? `<a class="btn btn-solid" href="${esc(data.links.skillsRepo)}" target="_blank" rel="noopener">Star the skills on GitHub ★</a>` : ''}</p>
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
    ${data.links.skillsRepo ? `<a class="btn btn-solid" href="${esc(data.links.skillsRepo)}/tree/main/${a.slug}" target="_blank" rel="noopener">Get it on GitHub ★</a>` : ''}
    ${a.zip ? `<a class="btn" href="${a.zip}" download>Download ${esc(a.slug)}.zip</a>` : ''}
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
    <form name="asset" method="POST" action="/api/submit">
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

      <label for="link">Link to the files <span class="dim">(GitHub, Notion, Drive, or a shared zip)</span></label>
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

/* ------------------------------------------------ page: lemlist entry hub

   Hidden landing page (noindex, absent from the nav and sitemap). It is the
   destination for the "lemlist academy" link on lemlist.com, and the ONLY page
   that states GTM Club is initiated by lemlist. Its job is to route a lemlist
   user to whichever GTM Club component fits their need. Route: /lemlist/. */
// FontAwesome Free 6.5 icons, inlined as SVG (CC BY 4.0) so the site stays
// zero-dependency, no CDN, CSP-safe. [viewBox, path]. icon() renders one.
const FA = {
  "arrow-right": ["0 0 448 512", "M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"],
  "bolt": ["0 0 448 512", "M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"],
  "book-open": ["0 0 576 512", "M249.6 471.5c10.8 3.8 22.4-4.1 22.4-15.5V78.6c0-4.2-1.6-8.4-5-11C247.4 52 202.4 32 144 32C93.5 32 46.3 45.3 18.1 56.1C6.8 60.5 0 71.7 0 83.8V454.1c0 11.9 12.8 20.2 24.1 16.5C55.6 460.1 105.5 448 144 448c33.9 0 79 14 105.6 23.5zm76.8 0C353 462 398.1 448 432 448c38.5 0 88.4 12.1 119.9 22.6c11.3 3.8 24.1-4.6 24.1-16.5V83.8c0-12.1-6.8-23.3-18.1-27.6C529.7 45.3 482.5 32 432 32c-58.4 0-103.4 20-123 35.6c-3.3 2.6-5 6.8-5 11V456c0 11.4 11.7 19.3 22.4 15.5z"],
  "box-open": ["0 0 640 512", "M58.9 42.1c3-6.1 9.6-9.6 16.3-8.7L320 64 564.8 33.4c6.7-.8 13.3 2.7 16.3 8.7l41.7 83.4c9 17.9-.6 39.6-19.8 45.1L439.6 217.3c-13.9 4-28.8-1.9-36.2-14.3L320 64 236.6 203c-7.4 12.4-22.3 18.3-36.2 14.3L37.1 170.6c-19.3-5.5-28.8-27.2-19.8-45.1L58.9 42.1zM321.1 128l54.9 91.4c14.9 24.8 44.6 36.6 72.5 28.6L576 211.6v167c0 22-15 41.2-36.4 46.6l-204.1 51c-10.2 2.6-20.9 2.6-31 0l-204.1-51C79 419.7 64 400.5 64 378.5v-167L191.6 248c27.8 8 57.6-3.8 72.5-28.6L318.9 128h2.2z"],
  "bullseye": ["0 0 512 512", "M448 256A192 192 0 1 0 64 256a192 192 0 1 0 384 0zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm256 80a80 80 0 1 0 0-160 80 80 0 1 0 0 160zm0-224a144 144 0 1 1 0 288 144 144 0 1 1 0-288zM224 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"],
  "calendar-days": ["0 0 448 512", "M128 0c17.7 0 32 14.3 32 32V64H288V32c0-17.7 14.3-32 32-32s32 14.3 32 32V64h48c26.5 0 48 21.5 48 48v48H0V112C0 85.5 21.5 64 48 64H96V32c0-17.7 14.3-32 32-32zM0 192H448V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V192zm64 80v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16zm128 0v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H208c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V272c0-8.8-7.2-16-16-16H336zM64 400v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H208zm112 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V400c0-8.8-7.2-16-16-16H336c-8.8 0-16 7.2-16 16z"],
  "comments": ["0 0 640 512", "M208 352c114.9 0 208-78.8 208-176S322.9 0 208 0S0 78.8 0 176c0 38.6 14.7 74.3 39.6 103.4c-3.5 9.4-8.7 17.7-14.2 24.7c-4.8 6.2-9.7 11-13.3 14.3c-1.8 1.6-3.3 2.9-4.3 3.7c-.5 .4-.9 .7-1.1 .8l-.2 .2 0 0 0 0C1 327.2-1.4 334.4 .8 340.9S9.1 352 16 352c21.8 0 43.8-5.6 62.1-12.5c9.2-3.5 17.8-7.4 25.3-11.4C134.1 343.3 169.8 352 208 352zM448 176c0 112.3-99.1 196.9-216.5 207C255.8 457.4 336.4 512 432 512c38.2 0 73.9-8.7 104.7-23.9c7.5 4 16 7.9 25.2 11.4c18.3 6.9 40.3 12.5 62.1 12.5c6.9 0 13.1-4.5 15.2-11.1c2.1-6.6-.2-13.8-5.8-17.9l0 0 0 0-.2-.2c-.2-.2-.6-.4-1.1-.8c-1-.8-2.5-2-4.3-3.7c-3.6-3.3-8.5-8.1-13.3-14.3c-5.5-7-10.7-15.4-14.2-24.7c24.9-29 39.6-64.7 39.6-103.4c0-92.8-84.9-168.9-192.6-175.5c.4 5.1 .6 10.3 .6 15.5z"],
  "download": ["0 0 512 512", "M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"],
  "film": ["0 0 512 512", "M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM48 368v32c0 8.8 7.2 16 16 16H96c8.8 0 16-7.2 16-16V368c0-8.8-7.2-16-16-16H64c-8.8 0-16 7.2-16 16zm368-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V368c0-8.8-7.2-16-16-16H416zM48 240v32c0 8.8 7.2 16 16 16H96c8.8 0 16-7.2 16-16V240c0-8.8-7.2-16-16-16H64c-8.8 0-16 7.2-16 16zm368-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V240c0-8.8-7.2-16-16-16H416zM48 112v32c0 8.8 7.2 16 16 16H96c8.8 0 16-7.2 16-16V112c0-8.8-7.2-16-16-16H64c-8.8 0-16 7.2-16 16zM416 96c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V112c0-8.8-7.2-16-16-16H416zM160 128v64c0 17.7 14.3 32 32 32H320c17.7 0 32-14.3 32-32V128c0-17.7-14.3-32-32-32H192c-17.7 0-32 14.3-32 32zm32 160c-17.7 0-32 14.3-32 32v64c0 17.7 14.3 32 32 32H320c17.7 0 32-14.3 32-32V320c0-17.7-14.3-32-32-32H192z"],
  "graduation-cap": ["0 0 640 512", "M320 32c-8.1 0-16.1 1.4-23.7 4.1L15.8 137.4C6.3 140.9 0 149.9 0 160s6.3 19.1 15.8 22.6l57.9 20.9C57.3 229.3 48 259.8 48 291.9v28.1c0 28.4-10.8 57.7-22.3 80.8c-6.5 13-13.9 25.8-22.5 37.6C0 442.7-.9 448.3 .9 453.4s6 8.9 11.2 10.2l64 16c4.2 1.1 8.7 .3 12.4-2s6.3-6.1 7.1-10.4c8.6-42.8 4.3-81.2-2.1-108.7C90.3 344.3 86 329.8 80 316.5V291.9c0-30.2 10.2-58.7 27.9-81.5c12.9-15.5 29.6-28 49.2-35.7l157-61.7c8.2-3.2 17.5 .8 20.7 9s-.8 17.5-9 20.7l-157 61.7c-12.4 4.9-23.3 12.4-32.2 21.6l159.6 57.6c7.6 2.7 15.6 4.1 23.7 4.1s16.1-1.4 23.7-4.1L624.2 182.6c9.5-3.4 15.8-12.5 15.8-22.6s-6.3-19.1-15.8-22.6L343.7 36.1C336.1 33.4 328.1 32 320 32zM128 408c0 35.3 86 72 192 72s192-36.7 192-72L496.7 262.6 354.5 314c-11.1 4-22.8 6-34.5 6s-23.5-2-34.5-6L143.3 262.6 128 408z"],
  "image": ["0 0 512 512", "M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6h96 32H424c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z"],
  "quote-left": ["0 0 448 512", "M0 216C0 149.7 53.7 96 120 96h8c17.7 0 32 14.3 32 32s-14.3 32-32 32h-8c-30.9 0-56 25.1-56 56v8h64c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V320 288 216zm256 0c0-66.3 53.7-120 120-120h8c17.7 0 32 14.3 32 32s-14.3 32-32 32h-8c-30.9 0-56 25.1-56 56v8h64c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H320c-35.3 0-64-28.7-64-64V320 288 216z"],
  "rocket": ["0 0 512 512", "M156.6 384.9L125.7 354c-8.5-8.5-11.5-20.8-7.7-32.2c3-8.9 7-20.5 11.8-33.8L24 288c-8.6 0-16.6-4.6-20.9-12.1s-4.2-16.7 .2-24.1l52.5-88.5c13-21.9 36.5-35.3 61.9-35.3l82.3 0c2.4-4 4.8-7.7 7.2-11.3C289.1-4.1 411.1-8.1 483.9 5.3c11.6 2.1 20.6 11.2 22.8 22.8c13.4 72.9 9.3 194.8-111.4 276.7c-3.5 2.4-7.3 4.8-11.3 7.2v82.3c0 25.4-13.4 49-35.3 61.9l-88.5 52.5c-7.4 4.4-16.6 4.5-24.1 .2s-12.1-12.2-12.1-20.9V380.8c-14.1 4.9-26.4 8.9-35.7 11.9c-11.2 3.6-23.4 .5-31.8-7.8zM384 168a40 40 0 1 0 0-80 40 40 0 1 0 0 80z"],
  "screwdriver-wrench": ["0 0 512 512", "M78.6 5C69.1-2.4 55.6-1.5 47 7L7 47c-8.5 8.5-9.4 22-2.1 31.6l80 104c4.5 5.9 11.6 9.4 19 9.4h54.1l109 109c-14.7 29-10 65.4 14.3 89.6l112 112c12.5 12.5 32.8 12.5 45.3 0l64-64c12.5-12.5 12.5-32.8 0-45.3l-112-112c-24.2-24.2-60.6-29-89.6-14.3l-109-109V104c0-7.5-3.5-14.5-9.4-19L78.6 5zM19.9 396.1C7.2 408.8 0 426.1 0 444.1C0 481.6 30.4 512 67.9 512c18 0 35.3-7.2 48-19.9L233.7 374.3c-7.8-20.9-9-43.6-3.6-65.1l-61.7-61.7L19.9 396.1zM512 144c0-10.5-1.1-20.7-3.2-30.5c-2.4-11.2-16.1-14.1-24.2-6l-63.9 63.9c-3 3-7.1 4.7-11.3 4.7H352c-8.8 0-16-7.2-16-16V102.6c0-4.2 1.7-8.3 4.7-11.3l63.9-63.9c8.1-8.1 5.2-21.8-6-24.2C388.7 1.1 378.5 0 368 0C288.5 0 224 64.5 224 144l0 .8 85.3 85.3c36-9.1 75.8 .5 104 28.7L429 274.5c49-23 83-72.8 83-130.5zM56 432a24 24 0 1 1 48 0 24 24 0 1 1 -48 0z"],
  "user-group": ["0 0 640 512", "M96 128a128 128 0 1 1 256 0A128 128 0 1 1 96 128zM0 482.3C0 383.8 79.8 304 178.3 304h91.4C368.2 304 448 383.8 448 482.3c0 16.4-13.3 29.7-29.7 29.7H29.7C13.3 512 0 498.7 0 482.3zM609.3 512H471.4c5.4-9.4 8.6-20.3 8.6-32v-8c0-60.7-27.1-115.2-69.8-151.8c2.4-.1 4.7-.2 7.1-.2h61.4C567.8 320 640 392.2 640 481.3c0 17-13.8 30.7-30.7 30.7zM432 256c-31 0-59-12.6-79.3-32.9C372.4 196.5 384 163.6 384 128c0-26.8-6.6-52.1-18.3-74.3C384.3 40.1 407.2 32 432 32c61.9 0 112 50.1 112 112s-50.1 112-112 112z"],
  "wand-magic-sparkles": ["0 0 576 512", "M234.7 42.7L197 56.8c-3 1.1-5 4-5 7.2s2 6.1 5 7.2l37.7 14.1L248.8 123c1.1 3 4 5 7.2 5s6.1-2 7.2-5l14.1-37.7L315 71.2c3-1.1 5-4 5-7.2s-2-6.1-5-7.2L277.3 42.7 263.2 5c-1.1-3-4-5-7.2-5s-6.1 2-7.2 5L234.7 42.7zM46.1 395.4c-18.7 18.7-18.7 49.1 0 67.9l34.6 34.6c18.7 18.7 49.1 18.7 67.9 0L529.9 116.5c18.7-18.7 18.7-49.1 0-67.9L495.3 14.1c-18.7-18.7-49.1-18.7-67.9 0L46.1 395.4zM484.6 82.6l-105 105-23.3-23.3 105-105 23.3 23.3zM7.5 117.2C3 118.9 0 123.2 0 128s3 9.1 7.5 10.8L64 160l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L128 160l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L128 96 106.8 39.5C105.1 35 100.8 32 96 32s-9.1 3-10.8 7.5L64 96 7.5 117.2zm352 256c-4.5 1.7-7.5 6-7.5 10.8s3 9.1 7.5 10.8L416 416l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L480 416l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L480 352l-21.2-56.5c-1.7-4.5-6-7.5-10.8-7.5s-9.1 3-10.8 7.5L416 352l-56.5 21.2z"],
};
const icon = (name, cls = '') => {
  const g = FA[name];
  if (!g) return '';
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="${g[0]}" aria-hidden="true" focusable="false"><path d="${g[1]}"/></svg>`;
};
// A labelled placeholder box for imagery/animation the manager can fill later.
const placeholder = (label, ic = 'image', cls = '') =>
  `<div class="ph${cls ? ' ' + cls : ''}" role="img" aria-label="${esc(label)} placeholder">${icon(ic, 'ph-ic')}<span class="ph-label">${esc(label)}</span></div>`;

// Logos of lemlist customers, shown in the hero trust bar. Text wordmarks for
// now; swap in real logo SVGs when provided (see /assets/logos/).
const LEM_LOGOS = ['xAI', 'ElevenLabs', 'Pennylane', 'Spendesk', 'PostHog', 'Spotify',
  'Vinted', 'Fireworks AI', 'AirOps', 'Attio', 'Crusoe', 'Doctolib', 'Dailymotion', 'Indeed'];

function lemlistPage(assets) {
  const tools = assets.filter(a => a.kind === 'Tool');
  const doors = [
    { title: 'Learn the motion', href: '/paths/', ext: false, icon: 'graduation-cap',
      body: 'Live paths taught by operators still running outbound. Leave each session with a working artifact.',
      cta: 'Join the waitlist' },
    { title: 'Grab an asset today', href: '/library/', ext: false, icon: 'box-open',
      body: `A free library of ${assets.length} skills and interactive tools. Ship this afternoon.`,
      cta: 'Open the library' },
    { title: 'Get unstuck with peers', href: data.links.apply, ext: true, icon: 'comments',
      body: 'A small room of operators who answer. Post the play that failed, get a real fix by tomorrow.',
      cta: 'Apply to the community' },
    { title: 'Watch it done live', href: '/events/', ext: false, icon: 'calendar-days',
      body: 'Teardowns, office hours and build nights. Bring your pipeline, leave with the next move.',
      cta: "See what's on" },
  ];
  const whatis = [
    { icon: 'user-group', h: 'What it is', b: 'A small, curated room of go-to-market operators, plus a free library of Claude skills and interactive tools. No gurus, no gated PDFs.' },
    { icon: 'bolt', h: 'What to expect', b: 'Post the sequence that failed or the number that lies, and get a real answer, fast. Ship a working artifact from every session.' },
    { icon: 'bullseye', h: "Who it's for", b: 'Founders, SDR and sales leads, RevOps and growth operators who run outbound with lemlist and want to get sharper at it.' },
  ];
  const stack = [
    ['Claude', 'The engine behind every skill in the club: agents, drafting and research in one place.', 'claude'],
    ['lemlist', 'Sequences, deliverability and AI variables. The outbound engine most of the club runs on.', 'lemlist'],
    ['Clay', 'Enrichment and signal waterfalls. Build the list before you write the first line.', 'clay'],
    ['HubSpot', 'CRM hygiene, routing and reporting your manager actually trusts.', 'hubspot'],
    ['Salesforce', 'Data model, dedup and attribution once you have scaled past the spreadsheet.', 'salesforce'],
    ['Slack', 'Where the alerts, the handoffs and the "who owns this" actually happen.', 'slack'],
    ['n8n', 'Glue it together. Automations and agents that handle the boring 80%.', 'n8n'],
  ];
  const logoRun = LEM_LOGOS.map(l => `<span class="lem-logo">${esc(l)}</span>`).join('');
  const body = `
<section class="lem-hero">
  <div class="aurora" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
  <video class="lem-hero-video" autoplay muted loop playsinline preload="metadata" poster="/assets/hero-poster.jpg" aria-hidden="true">
    <source src="/assets/hero-reel.webm" type="video/webm">
    <source src="/assets/hero-reel.mp4" type="video/mp4">
  </video>
  <div class="lem-hero-scrim" aria-hidden="true"></div>
  <div class="wrap lem-hero-in">
    <p class="eyebrow">Powered by lemlist</p>
    <h1>Where lemlist users level up.</h1>
    <p class="lede">The GTM Club is initiated by lemlist to help you drive real results from outbound. A community, interactive tools, live paths and events, all in one room.</p>
    <div class="hero-cta lem-cta">
      <a class="btn btn-solid" href="${esc(data.links.apply)}">${icon('rocket')} Join the GTM Club</a>
      <a class="btn" href="/library/">Explore the tools</a>
    </div>
  </div>
</section>

<section class="lem-logo-band">
  <div class="wrap lem-logobar">
    <p class="lem-logolabel">Go-to-market teams that run outbound with lemlist</p>
    <div class="lem-marquee"><div class="lem-track">${logoRun}${logoRun}</div></div>
  </div>
</section>

<section class="band lem-what">
  <div class="wrap">
    <div class="lem-head center">
      ${sectionLabel("What's the GTM Club")}
      <h2 class="display-md">The room where outbound gets better, together.</h2>
      <p class="lede center">Initiated by lemlist, the GTM Club is where operators go past the tool: to swap the plays that work, borrow the assets, and get unstuck the same week.</p>
    </div>
    <div class="lem-features">
      ${whatis.map(w => `<div class="lem-feature">
        <span class="lem-feat-ic">${icon(w.icon)}</span>
        <h3 class="display-sm">${esc(w.h)}</h3>
        <p class="card-sub">${esc(w.b)}</p>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="band lem-stack-band">
  <div class="wrap">
    <div class="lem-head">
      ${sectionLabel('Built for your stack')}
      <h2 class="display-md">The tools you already run.</h2>
      <p class="lede">The club goes deep on the GTM stack, with skills, plays and teardowns for each.</p>
    </div>
    <div class="lem-stack-grid">
      ${stack.map(([name, blurb, logo]) => `<a class="lem-stack" href="/library/">
        <span class="lem-stack-logo"><img src="/assets/logos/${logo}.svg" alt="${esc(name)}" width="30" height="30" loading="lazy"></span>
        <b class="lem-stack-name">${esc(name)}</b>
        <p>${esc(blurb)}</p>
        <span class="lem-tool-go">See the plays ${icon('arrow-right')}</span>
      </a>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="band lem-join">
  <div class="wrap lem-split">
    <div class="lem-split-a">
      ${sectionLabel('Join the GTM Club')}
      <h2 class="display-md">Four doors. Walk through any of them.</h2>
      <p class="lede">Wherever you are today, there is a way in that fits. Most people start with the library, then join the room.</p>
      ${placeholder('Community screenshot or animation', 'wand-magic-sparkles', 'ph-tall')}
    </div>
    <div class="lem-doorlist">
      ${doors.map(d => `<a class="lem-door" href="${esc(d.href)}"${d.ext ? ' target="_blank" rel="noopener"' : ''}>
        <span class="lem-door-ic">${icon(d.icon)}</span>
        <span class="lem-door-txt"><b>${esc(d.title)}</b><span>${esc(d.body)}</span><em>${esc(d.cta)}</em></span>
        <span class="lem-door-go">${icon('arrow-right')}</span>
      </a>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="band lem-quote-band">
  <div class="wrap narrow">
    <span class="lem-qmark">${icon('quote-left')}</span>
    <blockquote class="lem-quote">
      <p>The GTM Club is the first place I check on Monday. I post the sequence that flopped, and by Tuesday someone who ran the exact play has already pulled it apart for me.</p>
      <footer class="lem-quote-foot">
        <span class="lem-avatar" role="img" aria-label="Hugo T.">HT</span>
        <cite>Hugo T.<br><span>GTM engineer &middot; Member since June 2026</span></cite>
      </footer>
    </blockquote>
  </div>
</section>
${tools.length ? `
<section class="band lem-tools">
  <div class="wrap">
    <div class="lem-head">
      ${sectionLabel('Our GTM tools')}
      <h2 class="display-md">Free, interactive, no signup.</h2>
      <p class="lede">Try one right now. Each is a self-contained tool you can use in the browser.</p>
    </div>
    <div class="lem-tool-grid">
      ${tools.map(t => `<a class="lem-tool" href="${esc(t.url)}">
        <div class="lem-tool-preview"><img src="/assets/previews/${esc(t.slug)}.jpg" alt="${esc(t.title)} preview" loading="lazy"></div>
        <div class="lem-tool-body">
          <span class="lem-tool-ic">${icon('screwdriver-wrench')}</span>
          <b>${esc(t.title)}</b>
          <p>${esc(t.description)}</p>
          <span class="lem-tool-go">Open the tool ${icon('arrow-right')}</span>
        </div>
      </a>`).join('\n      ')}
    </div>
  </div>
</section>` : ''}

<section class="cta">
  <div class="wrap narrow">
    <div class="slashes"><i></i><i></i><i></i><i></i></div>
    <h2 class="display-lg">Ready to level up?</h2>
    <p class="lede center">Join the room where lemlist users turn outbound into pipeline. It is free, and most people find their first win in ten minutes.</p>
    <p><a class="btn btn-solid" href="${esc(data.links.apply)}">${icon('rocket')} Join the GTM Club</a></p>
  </div>
</section>`;

  return layout({
    title: 'GTM Club, by lemlist',
    description: 'The GTM Club, initiated by lemlist to help you drive real results from outbound. A community, a library of skills and tools, live paths and events.',
    canonical: '/lemlist/', current: '', noindex: true, body,
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
const THEME_JS_HREF = fingerprint('theme.js');

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

write('.', homePage(assets.length));
const PATHS_LIVE = false; // flip to true when the tracks launch, to serve the full pathsPage()
write('paths', PATHS_LIVE ? pathsPage() : pathsWaitlistPage());
// Hidden team-preview of the full course catalogue while /paths/ stays a waitlist.
// noindex + absent from NAV and the sitemap, so users can't find it; share the URL directly.
write('paths-preview', pathsPage({ canonical: '/paths-preview/', current: '', noindex: true }));
write('events', eventsPage(events));
write('community', communityPage());
write('library', libraryPage(assets, kinds, sources));
write('submit', submitPage(kindOptions));
write('submit/thanks', thanksPage());
// Hidden lemlist entry hub. Deliberately not in NAV or the sitemap urls below.
write('lemlist', lemlistPage(assets));

fs.writeFileSync(path.join(DIST, 'assets/library.json'), JSON.stringify(
  assets.map(({ dir, html, ...rest }) => rest), null, 2));

const urls = ['/', '/library/', '/paths/', '/events/', '/community/', '/submit/', ...assets.map(a => a.url)];
fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${SITE}${u}</loc></url>`).join('\n') + `\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`Built 5 pages, ${assets.length} assets, ${events.length} upcoming events`);
