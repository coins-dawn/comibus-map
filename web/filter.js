'use strict';
// 左ペインのフィルタ（季節・目的）。map.js のあとに読む。
// 季節: スポットの名前・種類・絵の目印から付けた目安（build_map.py の spot_season）。目的: スポットの種類をまとめ直したもの。
// 同じ欄の中は「どれか」、季節と目的の間は「両方」。路線は、条件に合うスポットを通るものだけ残す。
const SEASONS = ['春', '夏', '秋', '冬'];
const PURPOSES = [['onsen', '温泉'], ['castle', 'お城'], ['jisha', '神社・お寺'], ['museum', '博物館'], ['michi', '道の駅'],
  ['water', '海・水辺'], ['zoo', '動物'], ['view', '景色・公園']];
const SPOT_PURPOSE = { onsen: 'onsen', castle: 'castle', jinja: 'jisha', tera: 'jisha', museum: 'museum', michi: 'michi',
  beach: 'water', ferry: 'water', zoo: 'zoo', view: 'view', park: 'view', sky: 'view' };
const FILTER = { sea: new Set(), cat: new Set() };
const filterOn = () => FILTER.sea.size > 0 || FILTER.cat.size > 0;

// スポットが条件に合うか（季節と目的の両方）
function spotMatch(s) {
  if (FILTER.cat.size && !FILTER.cat.has(SPOT_PURPOSE[s[0]])) return false;
  if (FILTER.sea.size && ![...FILTER.sea].some((se) => (s[5] || '').includes(se))) return false;
  return true;
}
// 条件に合うスポットを通る路線（カードの番号）
function matchedCards() {
  const set = new Set();
  SPOTS.forEach((s) => { if (spotMatch(s)) s[4].forEach((c) => set.add(c)); });
  return set;
}

function applyFilter() {
  const on = filterOn(), cards = on ? [...matchedCards()] : null;
  const f = on ? ['in', ['get', 'c'], ['literal', cards]] : null;
  for (const id of ['routes', 'routes-case']) map.setFilter(id, f);
  // 絞り込んだら、引いた状態でも路線を見せる
  for (const id of ['routes', 'routes-case']) map.setLayerZoomRange(id, on ? 0 : Z_ROUTE - .5, 24);
  for (const id of ['routes', 'routes-case']) map.setPaintProperty(id, 'line-opacity', on ? 1 : ['interpolate', ['linear'], ['zoom'], Z_ROUTE - .5, 0, Z_ROUTE + .3, 1]);
  $('#filter-n').textContent = on ? `${cards.length.toLocaleString()} 路線` : '';
  $('#filter-clear').hidden = !on;
  refreshSpots();
}

function buildFilter() {
  const chip = (g, v, label) => `<button class="chip" data-g="${g}" data-v="${v}">${label}</button>`;
  $('#filter').innerHTML = `
    <div class="fl-row"><small>季節</small>${SEASONS.map((se) => chip('sea', se, se)).join('')}</div>
    <div class="fl-row"><small>目的</small>${PURPOSES.map(([v, l]) => chip('cat', v, l)).join('')}</div>
    <div class="fl-foot"><span id="filter-n"></span><button id="filter-clear" class="fl-clear" hidden>条件を外す</button></div>`;
  $('#filter').onclick = (e) => {
    const b = e.target.closest('.chip');
    if (b) {
      const set = FILTER[b.dataset.g];
      set.has(b.dataset.v) ? set.delete(b.dataset.v) : set.add(b.dataset.v);
      b.classList.toggle('on', set.has(b.dataset.v));
      applyFilter();
    } else if (e.target.id === 'filter-clear') {
      FILTER.sea.clear(); FILTER.cat.clear();
      document.querySelectorAll('#filter .chip').forEach((c) => c.classList.remove('on'));
      applyFilter();
    }
  };
}
