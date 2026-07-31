// Filters the pre-rendered cards on two facets, type and source, combined with
// AND. Cards exist in the HTML already, so the page works with JS off and search
// engines see every asset.
(function () {
  var grid = document.getElementById('grid');
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var count = document.getElementById('count');
  var empty = document.getElementById('empty');
  var state = { kind: 'All', source: 'All' };

  function apply() {
    var shown = 0;
    cards.forEach(function (c) {
      var on = (state.kind === 'All' || c.dataset.kind === state.kind) &&
               (state.source === 'All' || c.dataset.source === state.source);
      c.hidden = !on;
      if (on) shown++;
    });
    count.textContent = shown + (shown === 1 ? ' asset' : ' assets');
    empty.hidden = shown !== 0;
    chips.forEach(function (b) {
      var on = state[b.dataset.facet] === b.dataset.value;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    var params = new URLSearchParams();
    if (state.kind !== 'All') params.set('type', state.kind);
    if (state.source !== 'All') params.set('source', state.source);
    var qs = params.toString();
    history.replaceState(null, '', qs ? location.pathname + '?' + qs : location.pathname);
  }

  chips.forEach(function (b) {
    b.addEventListener('click', function () {
      state[b.dataset.facet] = b.dataset.value;
      apply();
    });
  });

  function valid(facet, value) {
    return chips.some(function (b) { return b.dataset.facet === facet && b.dataset.value === value; });
  }
  var q = new URLSearchParams(location.search);
  var t = q.get('type'), s = q.get('source');
  if (t && valid('kind', t)) state.kind = t;
  if (s && valid('source', s)) state.source = s;
  if (state.kind !== 'All' || state.source !== 'All') apply();
})();
