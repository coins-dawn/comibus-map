'use strict';
// 地図の上でバスを走らせる。GTFS の時刻表（data/f/<k>.json の便）から、いまの時刻（日本時間）に走っているはずの便の位置を計算して置く。
// 実際のバスの位置（リアルタイム）ではない。
// - 出すのは路線の線が見えるズーム（Z_ROUTE〜）から。引いた状態では出さない（2026-11-07 ユーザー指示）
// - 大きさはスポットの絵の縦横 1/4 くらい（2026-11-07 ユーザー指示）
// - 位置: 便の停留所を、その路線の形（shape）の上に順番に当てはめ、時刻の間を距離で割り振る
//   （時刻は分単位なので、同じ分の停留所が続くときは、次の分の停留所まで等速で動かす）
// - ?t=HH:MM で時刻を決め打ちできる（キャプチャ用）
const BUS_MAX_FEEDS = 60;
const busFeeds = new Map();   // k -> {F, cardOf: Map(r -> カードの番号), pats: Map}
let busTimer = null;

function busImages() {
  // 路線の色ごと × 向き（右・左）の小さなバス。幅 12px（スポットの絵 46px の約 1/4）
  ROUTE_COLORS.forEach((c, i) => {
    for (const dir of ['r', 'l']) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="44" viewBox="0 0 28 22"><g transform="${dir === 'l' ? 'translate(28 0) scale(-1 1)' : ''}">
        <path d="M3 6 Q3 2 7 2 H19 Q24 2 25.5 7 L26 13 Q26 16 23 16 H6 Q3 16 3 13 Z" fill="${c}" stroke="#fff" stroke-width="3" paint-order="stroke" stroke-linejoin="round"/>
        <path d="M3 6 Q3 2 7 2 H19 Q24 2 25.5 7 L26 13 Q26 16 23 16 H6 Q3 16 3 13 Z" fill="none" stroke="#4a3426" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M6 5 H21.5 Q23.5 5 24.3 9 H6 Z" fill="#dff3ff" stroke="#4a3426" stroke-width="1"/>
        <circle cx="9" cy="16.5" r="2.6" fill="#4a3426" stroke="#fff" stroke-width="1.2"/><circle cx="21" cy="16.5" r="2.6" fill="#4a3426" stroke="#fff" stroke-width="1.2"/></g></svg>`;
      const img = new Image(56, 44);
      img.onload = () => { if (!map.hasImage(`bus${i}${dir}`)) map.addImage(`bus${i}${dir}`, img, { pixelRatio: 4 }); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
  });
}

// いまの時刻（日本時間）: 日付の文字列と、その日の 0 時からの分
function busNow() {
  const d = new Date(Date.now() + 9 * 3600e3);
  let min = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60000;
  const t = params.get('t');
  if (t) { const [h, m] = t.split(':').map(Number); min = h * 60 + m + (Date.now() / 60000 - busT0) % 60; }
  return { day: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 864e5, min };
}
const busT0 = Date.now() / 60000;

// その日に走る service の番号の集まり（データの期間の外なら、期間内の同じ曜日）
function busServices(F, day) {
  const s0 = Date.parse(F.start + 'T00:00:00Z') / 864e5, n = F.days.length;
  let i = day - s0;
  if (i < 0) i += 7 * Math.ceil(-i / 7);
  if (i >= n) i -= 7 * Math.ceil((i - n + 1) / 7);
  return new Set(F.pats[F.days.charCodeAt(i) - 48] || []);
}

// 平面の座標（m）。緯度経度 → x, y
const busXY = (lat, lon, k) => [lon * 111320 * k, lat * 110574];

// 便の停留所の並びを形の上に当てはめる。返すのは {pts: [[lat, lon]...], cum: [m...], ds: [停留所ごとの距離]}
function busFit(F, r, stops) {
  const k = Math.cos(F.stops[stops[0]][1] * Math.PI / 180);
  const sp = stops.map((i) => busXY(F.stops[i][1], F.stops[i][2], k));
  const project = (line) => {
    const P = line.map(([la, lo]) => busXY(la, lo, k)), cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    let seg = 0, prev = 0, cost = 0;
    const ds = [];
    for (const [x, y] of sp) {
      let best = Infinity, bs = seg, bd = prev;
      for (let i = seg; i < P.length - 1; i++) {
        const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        let u = L2 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
        if (i === seg && cum[i] + u * Math.sqrt(L2) < prev) u = L2 ? (prev - cum[i]) / Math.sqrt(L2) : 0;
        u = Math.max(0, Math.min(1, u));
        const along = cum[i] + u * Math.sqrt(L2), d = Math.hypot(ax + u * dx - x, ay + u * dy - y);
        const sc = d + 0.05 * (along - prev);  // 先へ飛びすぎない（同じ道を 2 回通る形のため）
        if (sc < best) { best = sc; bs = i; bd = along; }
        if (along - prev > 30000) break;
      }
      const [ax, ay] = P[bs], [bx, by] = P[bs + 1] || P[bs], L = Math.hypot(bx - ax, by - ay), u = L ? (bd - cum[bs]) / L : 0;
      cost = Math.max(cost, Math.hypot(ax + u * (bx - ax) - x, ay + u * (by - ay) - y));
      ds.push(bd); seg = bs; prev = bd;
    }
    return { pts: line, cum, ds, cost };
  };
  let best = null;
  for (const [sr, line] of F.shape) {
    if (sr !== r || line.length < 2) continue;
    for (const l of [line, line.slice().reverse()]) {
      const f = project(l);
      if (!best || f.cost < best.cost) best = f;
    }
  }
  if (!best || best.cost > 400) best = project(stops.map((i) => [F.stops[i][1], F.stops[i][2]]));  // 形が合わなければ停留所を直線で結ぶ
  return best;
}

// 便のその時刻の距離（m）。時刻の節目（分が変わる最初の停留所）の間を等速で動かす
function busAlong(t, fit, now) {
  const tm = [], n = t[3].length;
  for (let j = 0; j < n; j++) {
    for (const v of [t[4][2 * j], t[4][2 * j + 1]]) {
      const T = t[2] + v, d = fit.ds[j];
      if (!tm.length || T > tm[tm.length - 1][0]) tm.push([T, d]);
    }
  }
  const last = tm[tm.length - 1];
  if (last[1] < fit.ds[n - 1]) tm.push([last[0] + 0.9, fit.ds[n - 1]]);
  if (now < tm[0][0] || now > tm[tm.length - 1][0]) return null;
  for (let i = 1; i < tm.length; i++)
    if (now <= tm[i][0]) { const [T0, d0] = tm[i - 1], [T1, d1] = tm[i]; return d0 + (d1 - d0) * (now - T0) / (T1 - T0); }
  return last[1];
}

function busPoint(fit, d) {
  const { pts, cum } = fit;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const a = pts[i - 1], b = pts[i], u = cum[i] > cum[i - 1] ? Math.max(0, Math.min(1, (d - cum[i - 1]) / (cum[i] - cum[i - 1]))) : 0;
  return { lat: a[0] + (b[0] - a[0]) * u, lon: a[1] + (b[1] - a[1]) * u, right: b[1] >= a[1] };
}

function busUpdate() {
  const src = map.getSource('buses');
  if (!src) return;
  const feats = [];
  if (map.getZoom() >= Z_ROUTE - .5) {
    const { day, min } = busNow();
    for (const [, B] of busFeeds) {
      if (!B.F) continue;
      // 今日の便と、前の日の便の 24 時を過ぎた部分
      for (const [dd, now] of [[day, min], [day - 1, min + 1440]]) {
        const sv = busServices(B.F, dd);
        for (const t of B.F.trips) {
          const c = B.cardOf.get(t[0]);
          if (c == null || !sv.has(t[1]) || now < t[2] || now > t[2] + t[4][t[4].length - 1] + 1) continue;
          const key = t[0] + ':' + t[3].join(',');
          if (!B.fits.has(key)) B.fits.set(key, busFit(B.F, t[0], t[3]));
          const fit = B.fits.get(key), d = busAlong(t, fit, now);
          if (d == null) continue;
          const p = busPoint(fit, d);
          feats.push({ type: 'Feature', properties: { c, img: `bus${CARDS[c].col || 0}${p.right ? 'r' : 'l'}` }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } });
        }
      }
    }
  }
  src.setData({ type: 'FeatureCollection', features: feats });
}

// 見えている範囲にかかる路線のフィードを読む
let busBox = null;
function busLoad() {
  if (map.getZoom() < Z_ROUTE - .5) { busFeeds.clear(); busUpdate(); return; }
  if (!busBox) {
    busBox = new Map();
    for (const [c, f] of Object.entries(ROUTES)) {
      const k = CARDS[c].k, b = busBox.get(k) || [180, 90, -180, -90];
      for (const l of f.geometry.coordinates) for (const [lo, la] of l) { b[0] = Math.min(b[0], lo); b[1] = Math.min(b[1], la); b[2] = Math.max(b[2], lo); b[3] = Math.max(b[3], la); }
      busBox.set(k, b);
    }
  }
  const bd = map.getBounds(), cx = bd.getCenter();
  const want = [...busBox].filter(([, b]) => b[0] <= bd.getEast() && b[2] >= bd.getWest() && b[1] <= bd.getNorth() && b[3] >= bd.getSouth())
    .sort((a, b) => Math.hypot((a[1][0] + a[1][2]) / 2 - cx.lng, (a[1][1] + a[1][3]) / 2 - cx.lat) - Math.hypot((b[1][0] + b[1][2]) / 2 - cx.lng, (b[1][1] + b[1][3]) / 2 - cx.lat))
    .slice(0, BUS_MAX_FEEDS).map(([k]) => k);
  const ws = new Set(want);
  for (const k of busFeeds.keys()) if (!ws.has(k)) busFeeds.delete(k);
  for (const k of want) {
    if (busFeeds.has(k)) continue;
    const B = { F: null, cardOf: new Map(), fits: new Map() };
    CARDS.forEach((c, i) => { if (c.k === k) for (const r of c.rs) B.cardOf.set(r, i); });
    busFeeds.set(k, B);
    getJSON(`data/f/${k}.json`).then((F) => { B.F = F; busUpdate(); });
  }
  busUpdate();
}

function initBuses() {
  busImages();
  map.addSource('buses', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'buses', type: 'symbol', source: 'buses', minzoom: Z_ROUTE - .5,
    layout: { 'icon-image': ['get', 'img'], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': 1 },
    paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], Z_ROUTE - .5, 0, Z_ROUTE + .3, 1] } });
  map.on('click', 'buses', (e) => openModal(CARDS[e.features[0].properties.c]));
  map.on('mouseenter', 'buses', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'buses', () => { map.getCanvas().style.cursor = ''; });
  map.on('moveend', busLoad);
  busLoad();
  clearInterval(busTimer);
  busTimer = setInterval(() => { if (!document.hidden && busFeeds.size) busUpdate(); }, 1000);
}
