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
