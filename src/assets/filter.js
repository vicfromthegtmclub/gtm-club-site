// Filters the pre-rendered cards by a text search plus two facets (type and
// source), all combined with AND. Cards exist in the HTML already (with a hidden
// data-search string), so the page works with JS off and search engines see
// every asset.
(function () {
  var grid = document.getElementById('grid');
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var count = document.getElementById('count');
  var empty = document.getElementById('empty');
  var input = document.getElementById('q');
  var state = { kind: 'All', source: 'All', q: '' };

  function apply() {
    var toks = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;
    cards.forEach(function (c) {
      var hay = c.dataset.search || '';
      var on = (state.kind === 'All' || c.dataset.kind === state.kind) &&
               (state.source === 'All' || c.dataset.source === state.source) &&
               toks.every(function (t) { return hay.indexOf(t) > -1; });
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
    if (state.q.trim()) params.set('q', state.q.trim());
    var qs = params.toString();
    history.replaceState(null, '', qs ? location.pathname + '?' + qs : location.pathname);
  }

  chips.forEach(function (b) {
    b.addEventListener('click', function () {
      state[b.dataset.facet] = b.dataset.value;
      apply();
    });
  });

  if (input) {
    input.addEventListener('input', function () { state.q = input.value; apply(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; state.q = ''; apply(); }
    });
  }

  function valid(facet, value) {
    return chips.some(function (b) { return b.dataset.facet === facet && b.dataset.value === value; });
  }
  var qp = new URLSearchParams(location.search);
  var t = qp.get('type'), s = qp.get('source'), qtext = qp.get('q');
  if (t && valid('kind', t)) state.kind = t;
  if (s && valid('source', s)) state.source = s;
  if (qtext) { state.q = qtext; if (input) input.value = qtext; }
  if (state.kind !== 'All' || state.source !== 'All' || state.q) apply();
})();
