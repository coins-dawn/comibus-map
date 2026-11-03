'use strict';
// コミバスマップ: 日本地図（引いた状態は都道府県の形だけ、広げると地理院タイル）の上に、全国のコミュニティバスの路線と沿線スポットのイラストを置く。
// 引いた状態: 自治体ごとの代表のスポットだけ。広げる: 路線（Z_ROUTE〜）、すべてのスポット・走るバス（Z_ALL〜）。
// 路線やイラストをタップすると、その路線のカードを開く（card.js の openModal）。
const Z_ROUTE = 8.5, Z_ALL = 10.5;
const CAT_ORDER = ['castle', 'zoo', 'sky', 'ferry', 'onsen', 'museum', 'view', 'michi', 'beach', 'jinja', 'tera', 'station', 'library', 'park'];
// 地方ごとの陸の色（北海道・東北・関東・中部・近畿・中国・四国・九州沖縄）
const LAND = ['#d4efc4', '#e3f2c2', '#fff0c2', '#ffe2c6', '#ffd8dc', '#ead9fb', '#d4ebff', '#ffe9b0'];
// 路線の色（build_map.py が近くの路線と重ならないように 0〜11 を振る）
const ROUTE_COLORS = ['#e2483d', '#2c6fc0', '#1e9e57', '#8a4fd6', '#f08c00', '#d6338a', '#0b9bb0', '#8c5a2b', '#6f8f00', '#3c3fb5', '#c9a000', '#5b6b78'];
const GSI = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';

let CARDS = [], SPOTS = [], REP = new Set(), ROUTES = {}, map;
const spotMarkers = new Map(), buses = new Map();

function spotEl(i) {
  const s = SPOTS[i], el = document.createElement('div');
  el.className = 'spot' + (REP.has(i) ? ' rep' : '');
  el.innerHTML = `<svg viewBox="0 0 64 64">${ICONS[s[0]]}</svg><span class="nm2">${esc(s[1].length > 10 ? s[1].slice(0, 9) + '…' : s[1])}</span>`;
  el.title = `${s[1]}（${CAT_LABEL[s[0]]}）`;
  el.addEventListener('click', (e) => { e.stopPropagation(); openModal(CARDS[s[4][0]]); });
  return el;
}

// 見えるスポットを決める。優先順に並べ、画面上で近すぎるものは出さない
function refreshSpots() {
  const z = map.getZoom(), all = z >= Z_ALL;
  const W = map.getContainer().clientWidth, H = map.getContainer().clientHeight;
  const cand = all ? SPOTS.map((_, i) => i) : [...REP];
  cand.sort((a, b) => (REP.has(b) - REP.has(a)) || CAT_ORDER.indexOf(SPOTS[a][0]) - CAT_ORDER.indexOf(SPOTS[b][0]));
  const gap = all ? 50 : 46, shown = new Set(), placed = [];
  for (const i of cand) {
    const s = SPOTS[i], p = map.project([s[3], s[2]]);
    if (p.x < -30 || p.y < -30 || p.x > W + 30 || p.y > H + 60) continue;
    if (placed.some((q) => Math.abs(q.x - p.x) < gap && Math.abs(q.y - p.y) < gap * .9)) continue;
    placed.push(p); shown.add(i);
    if (shown.size >= (all ? 140 : 90)) break;
  }
  for (const [i, m] of spotMarkers) if (!shown.has(i)) { m.remove(); spotMarkers.delete(i); }
  for (const i of shown) {
    if (spotMarkers.has(i)) continue;
    const s = SPOTS[i];
    const m = new maplibregl.Marker({ element: spotEl(i), anchor: 'bottom', offset: [0, REP.has(i) && !all ? -4 : 0] }).setLngLat([s[3], s[2]]).addTo(map);
    spotMarkers.set(i, m);
  }
  document.body.classList.toggle('zall', all);
  $('#mhint').textContent = z < Z_ROUTE ? '地図を広げると、コミュニティバスの路線が見えます'
    : !all ? 'もう少し広げると、すべてのスポットと走るバスが見えます' : '路線やイラストをタップすると、その路線のカードが見られます';
}

// ---- 走るバス
function lineOf(c) {
  const f = ROUTES[c];
  if (!f.line) {
    const ls = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
    const l = ls.slice().sort((a, b) => b.length - a.length)[0];
    const cum = [0];
    for (let i = 1; i < l.length; i++) {
      const k = Math.cos(l[i][1] * Math.PI / 180);
      cum.push(cum[i - 1] + Math.hypot((l[i][0] - l[i - 1][0]) * k, l[i][1] - l[i - 1][1]) * 111320);
    }
    f.line = { l, cum, len: cum[cum.length - 1] };
  }
  return f.line;
}
function refreshBuses() {
  const want = new Set();
  if (map.getZoom() >= Z_ALL) {
    for (const f of map.queryRenderedFeatures({ layers: ['routes'] })) {
      want.add(f.properties.c);
      if (want.size >= 24) break;
    }
  }
  for (const [c, b] of buses) if (!want.has(c)) { b.m.remove(); buses.delete(c); }
  for (const c of want) {
    if (buses.has(c)) continue;
    const L = lineOf(c);
    if (L.len < 50) continue;
    const el = document.createElement('div');
    el.className = 'mbus';
    el.innerHTML = `<svg viewBox="0 0 64 64"><g>${ICONS.bus}</g></svg>`;
    const m = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(L.l[0]).addTo(map);
    // 1 周の時間は長さに合わせる（12〜40 秒）
    buses.set(c, { m, el, L, period: Math.min(40, Math.max(12, L.len / 500)) * 1000, off: Math.random() });
  }
}
function animate(now) {  // still は card.js
  for (const b of buses.values()) {
    const { l, cum, len } = b.L;
    const d = (still ? .3 : ((now / b.period) + b.off) % 1) * len;
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
    const f = (d - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
    b.m.setLngLat([l[lo][0] + (l[hi][0] - l[lo][0]) * f, l[lo][1] + (l[hi][1] - l[lo][1]) * f]);
    b.el.classList.toggle('flip', l[hi][0] < l[lo][0]);
  }
  requestAnimationFrame(animate);
}

async function init() {
  const [japan, cards, spots, routes] = await Promise.all(['data/japan.json', 'data/cards.json', 'data/spots.json', 'data/routes.json'].map(getJSON));
  CARDS = cards.cards; SPOTS = spots.spots; REP = new Set(spots.rep);
  for (const f of routes.features) ROUTES[f.properties.c] = f;
  const lineW = (a, b) => ['interpolate', ['linear'], ['zoom'], Z_ROUTE, a, 14, b];
  map = new maplibregl.Map({
    container: 'map', attributionControl: false, minZoom: 3.4, maxZoom: 16.5, dragRotate: false, pitchWithRotate: false,
    maxBounds: [[115, 20], [155, 50]],
    bounds: [[128.5, 30.5], [146.2, 45.6]], fitBoundsOptions: { padding: { top: 70, bottom: 10, left: 10, right: 10 } },
    style: {
      version: 8,
      sources: {
        land: { type: 'geojson', data: japan.land, tolerance: 0.1 },  // 既定（0.375）だと引いた状態で北海道の塗りが抜ける
        gsi: { type: 'raster', tiles: [GSI], tileSize: 256, minzoom: 5, maxzoom: 18 },
        routes: { type: 'geojson', data: routes },
      },
      layers: [
        { id: 'sea', type: 'background', paint: { 'background-color': '#a9dcf5' } },
        { id: 'land-shadow', type: 'fill', source: 'land', paint: { 'fill-color': 'rgba(74,52,38,.22)', 'fill-translate': [2, 3] } },
        { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': ['match', ['get', 'r'], 0, LAND[0], 1, LAND[1], 2, LAND[2], 3, LAND[3], 4, LAND[4], 5, LAND[5], 6, LAND[6], LAND[7]] } },
        { id: 'gsi', type: 'raster', source: 'gsi', minzoom: 7.5, paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 7.5, 0, 9.5, .85], 'raster-saturation': -.35, 'raster-brightness-min': .08 } },
        { id: 'land-line', type: 'line', source: 'land', layout: { 'line-join': 'round' },
          paint: { 'line-color': '#4a3426', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, .9, 9, 1.8], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 1, 9.5, 0] } },
        { id: 'routes-case', type: 'line', source: 'routes', minzoom: Z_ROUTE - .5, layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#fff', 'line-width': lineW(3, 10), 'line-opacity': ['interpolate', ['linear'], ['zoom'], Z_ROUTE - .5, 0, Z_ROUTE + .3, 1] } },
        { id: 'routes', type: 'line', source: 'routes', minzoom: Z_ROUTE - .5, layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['match', ['get', 'col'], ...ROUTE_COLORS.flatMap((c, i) => [i, c]), ROUTE_COLORS[0]], 'line-width': lineW(1.6, 5),
            'line-opacity': ['interpolate', ['linear'], ['zoom'], Z_ROUTE - .5, 0, Z_ROUTE + .3, 1] } },
      ],
    },
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: [
    '経路・バス停: <a href="https://gtfs-data.jp/">GTFSデータリポジトリ</a>の各自治体の GTFS-JP（ライセンスはカードに表示）',
    'スポット: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    '地図: <a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>・Natural Earth',
    'イラスト: 自作'] }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
  map.touchZoomRotate.disableRotation();
  // 都道府県の名前（引いた状態だけ）
  const prefs = japan.labels.map(([n, lon, lat]) => {
    const el = document.createElement('div'); el.className = 'pref'; el.textContent = n;
    return new maplibregl.Marker({ element: el }).setLngLat([lon, lat]);
  });
  // 海の波（引いた状態だけ）。点ごとに動きの始まりをずらす
  const WAVE = '<svg viewBox="0 0 40 16"><path d="M2 12 Q7 4 12 9 Q15 12 18 8 Q23 1 28 8 Q31 12 34 9 Q36 7 38 9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M2 12 Q7 4 12 9 Q15 12 18 8 Q23 1 28 8 Q31 12 34 9 Q36 7 38 9" fill="none" stroke="#5aa9d6" stroke-width="1" stroke-linecap="round" opacity=".6" transform="translate(0 2)"/></svg>';
  const waves = (japan.waves || []).map(([lon, lat], i) => {
    const el = document.createElement('div'); el.className = 'seawave'; el.innerHTML = WAVE;
    el.firstChild.style.animationDelay = `${-((i * 0.37) % 1) * 3.2}s`;
    return new maplibregl.Marker({ element: el }).setLngLat([lon, lat]);
  });
  const showPrefs = () => {
    const on = map.getZoom() < 7;
    prefs.forEach((m) => (on ? m.addTo(map) : m.remove()));
    const sparse = map.getZoom() < 4.5;  // スマホで日本全体を見ると混みすぎるので半分に
    waves.forEach((m, i) => (on && !(sparse && i % 2) ? m.addTo(map) : m.remove()));
  };
  map.on('load', () => {
    const at = params.get('at');  // ?at=ズーム/緯度/経度（キャプチャ用）
    if (at) { const [z, la, lo] = at.split('/').map(Number); map.jumpTo({ zoom: z, center: [lo, la] }); }
    showPrefs(); refreshSpots(); map.once('idle', refreshBuses);
    requestAnimationFrame(animate);
  });
  map.on('moveend', () => { showPrefs(); refreshSpots(); map.once('idle', refreshBuses); });
  map.on('click', 'routes', (e) => openModal(CARDS[e.features[0].properties.c]));
  map.on('mouseenter', 'routes', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'routes', () => { map.getCanvas().style.cursor = ''; });
}
init();
