// Filters the pre-rendered cards. Cards exist in the HTML already, so the page
// works with JS off and search engines see every asset.
(function () {
  var grid = document.getElementById('grid');
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var count = document.getElementById('count');
  var empty = document.getElementById('empty');

  cards.forEach(function (c) {
    var pill = c.querySelector('.pill');
    c.dataset.kind = pill ? pill.textContent.trim() : '';
  });

  function apply(kind) {
    var shown = 0;
    cards.forEach(function (c) {
      var on = kind === 'All' || c.dataset.kind === kind;
      c.hidden = !on;
      if (on) shown++;
    });
    count.textContent = shown + (shown === 1 ? ' asset' : ' assets');
    empty.hidden = shown !== 0;
    chips.forEach(function (b) {
      var on = b.dataset.kind === kind;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    var url = kind === 'All' ? location.pathname : location.pathname + '?type=' + encodeURIComponent(kind);
    history.replaceState(null, '', url);
  }

  chips.forEach(function (b) {
    b.addEventListener('click', function () { apply(b.dataset.kind); });
  });

  var start = new URLSearchParams(location.search).get('type');
  if (start && chips.some(function (b) { return b.dataset.kind === start; })) apply(start);
})();
