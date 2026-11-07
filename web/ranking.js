'use strict';
// 左ペインのランキング（各ランキングの 1 位）。map.js のあとに読む。CARDS・ROUTES・map を使う。
// 悪口になるもの（距離あたりの運賃が高い など）は載せない。
// f が大きいほど上位。同じ値のときは距離の短い路線が上位（2026-11-07 ユーザー指示。すべてのランキングで同じ）
const SPOT_RANKS = [['onsen', '温泉'], ['jisha', '神社・お寺'], ['museum', '博物館'], ['castle', 'お城'], ['michi', '道の駅'],
  ['water', '海・水辺'], ['zoo', '動物'], ['view', '景色・公園']];
const nc = (c, k) => (c.ncat && c.ncat[k]) || 0;
const RANKS = [
  { t: '総距離が長い', f: (c) => c.km, ok: (c) => c.km > 0, v: (c) => `${c.km}km` },
  { t: '総距離が短い', f: (c) => -c.km, ok: (c) => c.nstops >= 3 && c.km > 0, v: (c) => `${c.km}km` },
  // 2026-11-07 ユーザー指示: 「距離あたりのバス停」ではなく「バス停の数」で
  { t: 'バス停が多い', f: (c) => c.nstops, ok: () => true, v: (c) => `${c.nstops} か所` },
  { t: 'バス停が少ない', f: (c) => -c.nstops, ok: (c) => c.km > 0, v: (c) => `${c.nstops} か所（${c.km}km）` },
  // 沿線（バス停から 200m 以内）のスポットを種類ごとに数える
  ...SPOT_RANKS.map(([k, label]) => ({ t: `${label}をいちばん多く通る`, cat: k, label, f: (c) => nc(c, k), ok: (c) => nc(c, k) > 0,
    v: (c) => `${label} ${nc(c, k)} か所（バス停から 200m 以内）` })),
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
    const best = idx.filter((i) => r.ok(CARDS[i])).sort((a, b) => (r.f(CARDS[b]) - r.f(CARDS[a])) || (CARDS[a].km - CARDS[b].km))[0];
    const c = CARDS[best];
    return `<button class="rk" data-i="${best}" data-k="${k}">
      <small class="rk-t">${esc(r.t)}</small>
      <span class="rk-1"><img class="crown" src="img/crown.svg" alt="1位" title="1位">${esc(c.name)}</span>
      <span class="rk-o">${esc(c.pref)}・${esc(c.op)}</span>
      <span class="rk-v">${esc(r.v(c))}</span></button>`;
  }).join('');
  $('#rank-list').innerHTML = html;
  $('#rank-list').onclick = (e) => {
    const b = e.target.closest('.rk');
    if (!b) return;
    const i = +b.dataset.i, bb = routeBounds(i), r = RANKS[+b.dataset.k];
    document.body.classList.remove('rank-open');
    // スポットのランキングから開いたときは、その種類のスポットをすべて一覧に出す（data/rankspots.json。1 位の路線だけ入っている）
    const open = async () => {
      let opt;
      if (r.cat) {
        const all = await getJSON('data/rankspots.json').catch(() => ({}));
        const list = (all[CARDS[i].id] || {})[r.cat];
        if (list) opt = { label: r.label, list };
      }
      openModal(CARDS[i], opt);
    };
    if (bb) {
      map.fitBounds(bb, { padding: 60, maxZoom: 14, duration: 1200 });
      map.once('moveend', open);
    } else open();
  };
  $('#rank-btn').onclick = () => document.body.classList.toggle('rank-open');
}
