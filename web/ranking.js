'use strict';
// 左ペインのランキング（各ランキングの 1 位）。map.js のあとに読む。CARDS・ROUTES・map を使う。
// 悪口になるもの（距離あたりの運賃が高い など）は載せない。
const RANKS = [
  { t: '総距離が長い', f: (c) => c.km, ok: (c) => c.km > 0, v: (c) => `${c.km}km` },
  { t: '総距離が短い', f: (c) => -c.km, ok: (c) => c.nstops >= 3 && c.km > 0, v: (c) => `${c.km}km` },
  { t: '距離あたりのバス停が多い', f: (c) => c.nstops / c.km, ok: (c) => c.km >= 1, v: (c) => `1km に ${(c.nstops / c.km).toFixed(1)} か所` },
  { t: '距離あたりのバス停が少ない', f: (c) => -c.nstops / c.km, ok: (c) => c.km >= 1, v: (c) => `1km に ${(c.nstops / c.km).toFixed(2)} か所` },
];

function routeBounds(i) {
  const f = ROUTES[i];
  if (!f) return null;
  const pts = f.geometry.coordinates.flat();
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
}

function buildRanking() {
  const idx = CARDS.map((c, i) => i);
  const html = RANKS.map((r, k) => {
    const best = idx.filter((i) => r.ok(CARDS[i])).sort((a, b) => r.f(CARDS[b]) - r.f(CARDS[a]))[0];
    const c = CARDS[best];
    return `<button class="rk" data-i="${best}">
      <small class="rk-t">${esc(r.t)}</small>
      <span class="rk-1"><img class="crown" src="img/crown.svg" alt="1位" title="1位">${esc(c.name)}</span>
      <span class="rk-o">${esc(c.pref)}・${esc(c.op)}</span>
      <span class="rk-v">${esc(r.v(c))}</span></button>`;
  }).join('');
  $('#rank-list').innerHTML = html;
  $('#rank-list').onclick = (e) => {
    const b = e.target.closest('.rk');
    if (!b) return;
    const i = +b.dataset.i, bb = routeBounds(i);
    document.body.classList.remove('rank-open');
    if (bb) {
      map.fitBounds(bb, { padding: 60, maxZoom: 14, duration: 1200 });
      map.once('moveend', () => openModal(CARDS[i]));
    } else openModal(CARDS[i]);
  };
  $('#rank-btn').onclick = () => document.body.classList.toggle('rank-open');
}
