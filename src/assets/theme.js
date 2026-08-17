// Light/dark toggle. The saved choice is applied before paint by a tiny inline
// script in <head>; this only wires the button and persists changes.
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('themeToggle');
  if (!btn) return;

  function sync() {
    var light = root.getAttribute('data-theme') === 'light';
    btn.textContent = light ? 'Dark' : 'Light';
    btn.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
  }

  btn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('gtm-theme', next); } catch (e) {}
    sync();
  });

  sync();
})();

// Mobile nav: the hamburger toggles a dropdown menu (below 760px).
(function () {
  var nav = document.querySelector('.nav');
  var toggle = document.getElementById('navToggle');
  if (!nav || !toggle) return;

  function close() { nav.removeAttribute('data-open'); toggle.setAttribute('aria-expanded', 'false'); }
  function open() { nav.setAttribute('data-open', ''); toggle.setAttribute('aria-expanded', 'true'); }

  toggle.addEventListener('click', function () {
    if (nav.hasAttribute('data-open')) close(); else open();
  });

  var menu = document.getElementById('navMenu');
  if (menu) menu.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', function () { if (window.innerWidth > 760) close(); });
})();

// "Time spent not shipping" nudge. A bar that fills with active time on the
// site (paused when the tab is hidden), accumulated across pages this session.
// When full it flips to a cheeky "go ship" prompt. Dismissible for the session.
(function () {
  var bar = document.getElementById('shipbar');
  if (!bar) return;
  var TARGET = 3 * 60 * 1000;               // active ms to a full bar
  var MS = 'gtm-ship-ms', DISMISS = 'gtm-ship-x';
  var ss = window.sessionStorage;
  try { if (ss && ss.getItem(DISMISS)) return; } catch (e) {}

  var fill = document.getElementById('shipbarFill');
  var label = document.getElementById('shipbarLabel');
  var cta = document.getElementById('shipbarCta');
  var x = document.getElementById('shipbarX');
  var ms = 0; try { ms = parseInt((ss && ss.getItem(MS)) || '0', 10) || 0; } catch (e) {}
  var last = Date.now(), full = false;

  function render() {
    var p = Math.min(ms / TARGET, 1);
    fill.style.width = (p * 100).toFixed(1) + '%';
    if (p >= 1 && !full) {
      full = true;
      bar.classList.add('is-full');
      if (label) label.textContent = "You're still here";
      if (cta) cta.hidden = false;
    }
  }
  function save() { try { if (ss) ss.setItem(MS, String(ms)); } catch (e) {} }

  setTimeout(function () { bar.hidden = false; render(); }, 1200);

  var iv = setInterval(function () {
    var now = Date.now();
    if (!document.hidden) ms += now - last;
    last = now;
    render(); save();
  }, 1000);

  document.addEventListener('visibilitychange', function () { last = Date.now(); });
  window.addEventListener('pagehide', save);
  if (x) x.addEventListener('click', function () {
    bar.hidden = true; clearInterval(iv);
    try { if (ss) ss.setItem(DISMISS, '1'); } catch (e) {}
  });
})();
