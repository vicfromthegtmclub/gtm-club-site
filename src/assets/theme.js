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
