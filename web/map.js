'use strict';
// 全国コミバスまっぷ: 日本地図（引いた状態は都道府県の形だけ、広げると地理院タイル）の上に、全国のコミュニティバスの路線と沿線スポットのイラストを置く。
// 引いた状態: 自治体ごとの代表のスポットだけ。広げる: 路線（Z_ROUTE〜）、すべてのスポット（Z_ALL〜）。地図の上ではバスを走らせない（カードの中だけ。2026-11-03 ユーザー指示）。
// 路線やイラストをタップすると、その路線のカードを開く（card.js の openModal）。
const Z_ROUTE = 8.5, Z_ALL = 10.5;
const CAT_ORDER = ['castle', 'zoo', 'sky', 'ferry', 'onsen', 'museum', 'view', 'michi', 'beach', 'jinja', 'tera', 'station', 'library', 'park'];
// 地方ごとの陸の色（北海道・東北・関東・中部・近畿・中国・四国・九州沖縄）
const LAND = ['#d4efc4', '#e3f2c2', '#fff0c2', '#ffe2c6', '#ffd8dc', '#ead9fb', '#d4ebff', '#ffe9b0'];
// 路線の色（build_map.py が近くの路線と重ならないように 0〜11 を振る）
const ROUTE_COLORS = ['#e2483d', '#2c6fc0', '#1e9e57', '#8a4fd6', '#f08c00', '#d6338a', '#0b9bb0', '#8c5a2b', '#6f8f00', '#3c3fb5', '#c9a000', '#5b6b78'];
const GSI = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';

let CARDS = [], SPOTS = [], REP = new Set(), ROUTES = {}, map;
const spotMarkers = new Map();

function spotEl(i) {
  const s = SPOTS[i], el = document.createElement('div');
  el.className = 'spot' + (REP.has(i) ? ' rep' : '');
  el.innerHTML = `<svg viewBox="0 0 64 64" overflow="visible">${spotIcon(s)}</svg><span class="nm2">${esc(s[1].length > 10 ? s[1].slice(0, 9) + '…' : s[1])}</span>`;
  el.title = `${s[1]}（${CAT_LABEL[s[0]]}）`;
  el.addEventListener('click', (e) => { e.stopPropagation(); openModal(CARDS[s[4][0]]); });
  return el;
}

// 見えるスポットを決める。優先順に並べ、画面上で近すぎるものは出さない
function refreshSpots() {
  const z = map.getZoom(), all = z >= Z_ALL;
  const W = map.getContainer().clientWidth, H = map.getContainer().clientHeight;
  // 絞り込み中は、条件に合うスポットだけ（引いた状態でも代表に限らない）
  const fon = typeof filterOn === 'function' && filterOn();
  const cand = fon ? SPOTS.map((_, i) => i).filter((i) => spotMatch(SPOTS[i])) : all ? SPOTS.map((_, i) => i) : [...REP];
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
  // ガイドの文は出さない（2026-11-03 ユーザー指示）
}

// ---- 海の波: どのズームでも、見えている海に画面の間隔（85〜170px）で並べる。
// 格子はズームの整数ごとに地図に固定し（動かしても波がついてくる）、点ごとに少しずらす。陸（都道府県の形）から離れた点だけ。
const WAVE = '<svg viewBox="0 0 40 16"><path d="M2 12 Q7 4 12 9 Q15 12 18 8 Q23 1 28 8 Q31 12 34 9 Q36 7 38 9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M2 12 Q7 4 12 9 Q15 12 18 8 Q23 1 28 8 Q31 12 34 9 Q36 7 38 9" fill="none" stroke="#5aa9d6" stroke-width="1" stroke-linecap="round" opacity=".6" transform="translate(0 2)"/></svg>';
let RINGS = [];
const waveMarkers = new Map();
const mx = (lon) => (lon + 180) / 360;
const my = (lat) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2; };
const unmy = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
function initWaves(land) {
  for (const f of land.features)
    for (const poly of f.geometry.coordinates) {
      const r = poly[0].map(([lo, la]) => [mx(lo), my(la)]);
      const xs = r.map((p) => p[0]), ys = r.map((p) => p[1]);
      RINGS.push({ r, bb: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] });
    }
}
function onLand(x, y) {
  for (const { r, bb } of RINGS) {
    if (x < bb[0] || x > bb[1] || y < bb[2] || y > bb[3]) continue;
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++)
      if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
    if (c) return true;
  }
  return false;
}
const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function refreshWaves() {
  const z = map.getZoom(), L = Math.floor(z), world = 512 * 2 ** z;
  const step = 85 / (512 * 2 ** L);  // 格子の間隔（ズーム L で 85px。L と L+1 の間では 85〜170px）
  const bd = map.getBounds(), x0 = mx(bd.getWest()), x1 = mx(bd.getEast()), y0 = my(bd.getNorth()), y1 = my(bd.getSouth());
  // 陸から離す幅: 画面で 22px か 800m の大きいほう（都道府県の形は数百 m ずれるので、広げたときは岸に寄せない）
  const lat = map.getCenter().lat, mg = Math.max(22 / world, 800 / (40075016 * Math.cos(lat * Math.PI / 180)));
  const want = new Set();
  for (let j = Math.floor(y0 / step) - 1; j <= Math.ceil(y1 / step); j++)
    for (let i = Math.floor(x0 / step) - 1; i <= Math.ceil(x1 / step); i++) {
      const id = `${L}:${i}:${j}`;
      const x = (i + .5 * (j & 1) + (hash(i, j, L) - .5) * .5) * step, y = (j + (hash(j, i, L + 7) - .5) * .4) * step;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      if (!waveMarkers.has(id)) {
        if ([[0, 0], [mg, 0], [-mg, 0], [0, mg], [0, -mg]].some(([dx, dy]) => onLand(x + dx, y + dy))) continue;
        const el = document.createElement('div'); el.className = 'seawave'; el.innerHTML = WAVE;
        el.firstChild.style.animationDelay = `${-hash(i, j, 3) * 3.2}s`;
        waveMarkers.set(id, new maplibregl.Marker({ element: el }).setLngLat([x * 360 - 180, unmy(y)]).addTo(map));
      }
      want.add(id);
    }
  for (const [id, m] of waveMarkers) if (!want.has(id)) { m.remove(); waveMarkers.delete(id); }
}

async function init() {
  const [japan, cards, spots, routes] = await Promise.all(['data/japan.json', 'data/cards.json', 'data/spots.json', 'data/routes.json'].map(getJSON));
  await loadSpotArt();
  CARDS = cards.cards; SPOTS = spots.spots; REP = new Set(spots.rep);
  // カードの線も地図と同じ色にする（card.js の mapSVG が card.col を見る）
  for (const f of routes.features) { ROUTES[f.properties.c] = f; CARDS[f.properties.c].col = f.properties.col; }
  const lineW = (a, b) => ['interpolate', ['linear'], ['zoom'], Z_ROUTE, a, 14, b];
  map = new maplibregl.Map({
    container: 'map', attributionControl: false, minZoom: 2.5, maxZoom: 16.5, dragRotate: false, pitchWithRotate: false,
    maxBounds: [[100, 5], [170, 60]],  // 狭いと縦長の画面でズームが下限で止まり、日本全体が入らない
    // 初期の範囲: 北海道の北端（宗谷岬）から鹿児島の南端（本土の佐多岬）まで。沖縄まで入れると小さくなりすぎる（2026-11-03 ユーザー指示）
    bounds: [[128.6, 30.95], [145.9, 45.6]], fitBoundsOptions: { padding: { top: 14, bottom: 30, left: innerWidth > 760 ? 320 : 8, right: 8 } },  // PC は浮いた左ペインのぶん空ける
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
    'イラスト: 自作', 'ロゴのバス: <a href="https://github.com/googlefonts/noto-emoji">Noto Emoji</a>（Apache 2.0）'] }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');  // 左下は浮いた左ペインと重なる
  map.touchZoomRotate.disableRotation();
  // 都道府県の名前（引いた状態だけ）
  const prefs = japan.labels.map(([n, lon, lat]) => {
    const el = document.createElement('div'); el.className = 'pref'; el.textContent = n;
    return new maplibregl.Marker({ element: el }).setLngLat([lon, lat]);
  });
  const showPrefs = () => {};  // 都道府県名は出さない（ノイズになる。2026-11-03 ユーザー指示）
  initWaves(japan.land);
  map.on('load', () => {
    if (typeof buildRanking === 'function') buildRanking();
    if (typeof buildFilter === 'function') buildFilter();
    const at = params.get('at');  // ?at=ズーム/緯度/経度（キャプチャ用）
    if (at) { const [z, la, lo] = at.split('/').map(Number); map.jumpTo({ zoom: z, center: [lo, la] }); }
    showPrefs(); refreshWaves(); refreshSpots();
    // 出典の欄は最初は閉じておく（スマホで地図の下を隠すため）。ⓘ で開く
    document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  });
  map.on('moveend', () => { showPrefs(); refreshWaves(); refreshSpots(); });
  map.on('click', 'routes', (e) => openModal(CARDS[e.features[0].properties.c]));
  map.on('mouseenter', 'routes', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'routes', () => { map.getCanvas().style.cursor = ''; });
}
init();
