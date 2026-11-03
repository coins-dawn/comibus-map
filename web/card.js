'use strict';
// カード 1 枚を描く処理（全国コミバスまっぷとガチャで共通）。icons.js のあとに読む。
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const STARS = { SSR: '★★★★★', SR: '★★★★', R: '★★★' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 乱数（?seed= を付けると同じ結果。キャプチャ用）
let rnd = Math.random;
if (params.get('seed')) {
  let a = +params.get('seed') >>> 0;
  rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const cache = {};
const getJSON = (u) => (cache[u] = cache[u] || fetch(u).then((r) => r.json()));

// ---- 絵の窓（SVG）
const TILE = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
const merc = (lat, lon) => { const r = lat * Math.PI / 180; return [(lon + 180) / 360, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2]; };
// 駅の記号（Iconify mdi:train, Apache 2.0）
const TRAIN_D = 'M12 2c-4 0-8 .5-8 4v9.5A3.5 3.5 0 0 0 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19a3.5 3.5 0 0 0 3.5-3.5V6c0-3.5-3.58-4-8-4M7.5 17A1.5 1.5 0 0 1 6 15.5A1.5 1.5 0 0 1 7.5 14A1.5 1.5 0 0 1 9 15.5A1.5 1.5 0 0 1 7.5 17m3.5-7H6V6h5zm2 0V6h5v4zm3.5 7a1.5 1.5 0 0 1-1.5-1.5a1.5 1.5 0 0 1 1.5-1.5a1.5 1.5 0 0 1 1.5 1.5a1.5 1.5 0 0 1-1.5 1.5';
const LINE_COLOR = { SSR: '#8a4fd6', SR: '#e2483d', R: '#2c6fc0' };

function mapSVG(card, F, spots, W = BOX_W, H = BOX_H - BOX_T, acc = null) {
  const rs = new Set(card.rs);
  let lines = F.shape.filter((l) => rs.has(l[0])).map((l) => l[1]);
  const trips = F.trips.filter((t) => rs.has(t[0]));
  if (!lines.length) lines = [trips[0][3].map((i) => [F.stops[i][1], F.stops[i][2]])];
  const stops = [...new Set(trips.flatMap((t) => t[3]))].map((i) => F.stops[i]);
  // 駅前・駅から歩ける路線は、駅と歩く道も枠に入れる
  const walk = acc && (acc.mode === 'walk' || acc.mode === 'at') ? acc : null;
  const pts = lines.flat().concat(spots.map((s) => [s[2], s[3]])).concat(walk ? [[walk.lat, walk.lon]] : []).map((p) => merc(p[0], p[1]));
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
  const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  // 絵は点の上に伸びるので、上の余白を広くとる
  const padX = 30, padT = 50, padB = 22;
  const s = Math.min((W - 2 * padX) / (x1 - x0 || 1e-9), (H - padT - padB) / (y1 - y0 || 1e-9), 256 * 2 ** 16);  // 短い路線で拡大しすぎない
  const wx = (x0 + x1) / 2 - W / 2 / s, wy = y0 - (padT + (H - padT - padB - (y1 - y0) * s) / 2) / s;
  const P = (lat, lon) => { const m = merc(lat, lon); return [(m[0] - wx) * s, (m[1] - wy) * s]; };
  const z = Math.max(5, Math.min(16, Math.round(Math.log2(s * 2 / 256)))), n = 2 ** z, ts = s / n;
  let tiles = '';
  for (let tx = Math.floor(wx * n); tx <= Math.floor((wx + W / s) * n); tx++)
    for (let ty = Math.floor(wy * n); ty <= Math.floor((wy + H / s) * n); ty++)
      tiles += `<image href="${TILE.replace('{z}', z).replace('{x}', tx).replace('{y}', ty)}" x="${((tx / n - wx) * s).toFixed(1)}" y="${((ty / n - wy) * s).toFixed(1)}" width="${(ts + .5).toFixed(1)}" height="${(ts + .5).toFixed(1)}"/>`;
  const dOf = (l) => l.map((p, i) => { const [x, y] = P(p[0], p[1]); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('');
  const d = lines.map(dOf).join('');
  const dots = stops.map((st) => { const [x, y] = P(st[1], st[2]); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`; }).join('');
  // スポットの絵を、重ならない位置に置く（点の上 → 右上 → 左上 → 右 → 左 → 下）
  const SZ = 32;  // 絵の大きさ（重ならないよう小さめ。2026-11-03）
  const placed = [];
  const OFFS = [[0, -10], [22, -22], [-22, -22], [30, 6], [-30, 6], [0, 46], [36, -36], [-36, -36], [0, -44]];
  const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  // 駅（Iconify mdi:train）と、駅からバス停まで歩く道（点線）。名札はスポットの絵より先に場所を取り、いちばん上に描く
  let stPath = '', stTag = '';
  if (walk) {
    const [sx, sy] = P(walk.lat, walk.lon);
    if (walk.path) stPath = `<path d="${dOf(walk.path)}" fill="none" stroke="#3d3d44" stroke-width="2.2" stroke-dasharray="1 4" stroke-linecap="round"/>`;
    const label = `${walk.st}駅`, tw = label.length * 11 + 26, th = 22;
    // 名札は駅の点のすぐ上（同じ駅のスポットの絵は下で外す。引き込み線はやめた 2026-11-03）
    const bx = Math.min(Math.max(sx - tw / 2, 2), W - tw - 2), by = Math.min(Math.max(sy - th - 8, 2), H - th - 2);
    placed.push([bx, by, bx + tw, by + th]);
    stTag = `<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><rect width="${tw}" height="${th}" fill="#3d3d44"/>
      <svg x="4" y="3" width="16" height="16" viewBox="0 0 24 24"><path fill="#fff" d="${TRAIN_D}"/></svg>
      <text x="22" y="15.5" font-size="12" font-weight="800" fill="#fff">${esc(label)}</text></g>
      <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="3.4" fill="#fff" stroke="#3d3d44" stroke-width="2"/>`;
    // 同じ駅が沿線のスポット（駅の絵）にもあれば、絵は出さない（名札と重なる）
    spots = spots.filter((sp) => !(sp[0] === 'station' && (sp[1] === walk.st || Math.hypot(...P(sp[2], sp[3]).map((v, i) => v - [sx, sy][i])) < 30)));
  }
  let art = '';
  // 置く場所の候補: 点のまわり 12 方向 × 5 段の距離（近い順）。絵と名前を合わせた範囲がほかと重ならない場所を選ぶ
  const CAND = [[0, -4]];
  for (const r of [24, 40, 56, 74, 94]) for (let k = 0; k < 12; k++) { const t = k * Math.PI / 6 - Math.PI / 2; CAND.push([Math.round(Math.cos(t) * r), Math.round(Math.sin(t) * r)]); }
  for (const sp of spots) {
    const [x, y] = P(sp[2], sp[3]);
    const lab = sp[1].length > 9 ? sp[1].slice(0, 8) + '…' : sp[1], hw = Math.max(SZ / 2, lab.length * 4.6 + 2);
    let best = null;
    for (const [dx, dy] of CAND) {
      const ix = x + dx, iy = y + dy;  // iy は絵の足もと
      const box = [ix - hw, iy - SZ * .9, ix + hw, iy + 11];
      const out = Math.max(0, -box[0]) + Math.max(0, box[2] - W) + Math.max(0, -box[1]) + Math.max(0, box[3] - H);
      const cost = placed.reduce((a, b) => a + overlap(box, b), 0) * 50 + out * 200 + Math.hypot(dx, dy);
      if (!best || cost < best.cost) best = { ix, iy, box, cost };
    }
    placed.push(best.box);
    const label = lab;
    art += `<g>${Math.hypot(best.ix - x, best.iy - y) > 10 ? `<path d="M${x.toFixed(1)} ${y.toFixed(1)} L${best.ix.toFixed(1)} ${(best.iy - 3).toFixed(1)}" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 2"/>` : ''}
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="${INK}"/>
      <svg x="${(best.ix - SZ / 2).toFixed(1)}" y="${(best.iy - SZ * .9).toFixed(1)}" width="${SZ}" height="${SZ}" viewBox="0 0 64 64" overflow="visible">${spotIcon(sp)}</svg>
      <text class="lbl" x="${best.ix.toFixed(1)}" y="${(best.iy + 8).toFixed(1)}" text-anchor="middle">${esc(label)}</text></g>`;
  }
  const busD = dOf(lines.slice().sort((a, b) => b.length - a.length)[0]);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
    <g class="bgmap">${tiles}</g>
    <path d="${d}" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${card.col != null && typeof ROUTE_COLORS !== 'undefined' ? ROUTE_COLORS[card.col] : LINE_COLOR[card.rare]}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${stPath}${dots}${art}${stTag}
    <path class="bus-path" d="${busD}" fill="none" stroke="none"/>
    <g class="bus"><svg x="-15" y="-24" width="30" height="30" viewBox="0 0 64 64" overflow="visible"><g class="bus-flip">${ICONS.bus}</g></svg></g></svg>`;
}

// バスを経路の上で走らせる（16 秒で 1 周）
const runners = new Set();
function runBus(root) {
  const path = root.querySelector('.bus-path'), g = root.querySelector('.bus'), flip = root.querySelector('.bus-flip');
  if (!path) return;
  runners.add({ path, g, flip, L: path.getTotalLength(), off: rnd() });
}
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
function tick(now) {
  for (const r of runners) {
    if (!r.g.isConnected) { runners.delete(r); continue; }
    const t = still ? .15 : ((now / 16000) + r.off) % 1;
    const p = r.path.getPointAtLength(t * r.L), q = r.path.getPointAtLength(Math.min(r.L, t * r.L + 2));
    r.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    r.flip.setAttribute('transform', q.x < p.x - 0.05 ? 'translate(64 0) scale(-1 1)' : '');
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// 路線を描いた四角い枠（2026-11-03: カードの見せ方をやめた）。路線名は上に 1 回だけ。数字は右の欄に出す
const BOX_W = 340, BOX_H = 400, BOX_T = 40;  // 枠の幅・高さ・路線名の帯の高さ
function cardHTML(card) {
  const nmc = card.name.length > 18 ? 'l' : card.name.length > 13 ? 'm' : '';
  const col = card.col != null && typeof ROUTE_COLORS !== 'undefined' ? ROUTE_COLORS[card.col] : '#2c6fc0';
  return `<div class="rbox" style="--pc:${col}">
    <div class="rbox-t ${nmc}">${esc(card.name)}</div>
    <div class="map"></div>
  </div>`;
}

// アクセス（右の欄）: 大きめの駅から、このコミバスへのつなぎ方。build_access.py が作る data/access.json
const OPS = { '東日本旅客鉄道': 'JR', '西日本旅客鉄道': 'JR', '東海旅客鉄道': 'JR', '九州旅客鉄道': 'JR', '北海道旅客鉄道': 'JR', '四国旅客鉄道': 'JR' };
const lineName = (l) => { const [op, ...ln] = l.split(' '); return OPS[op] ? `${OPS[op]}${ln.join(' ')}` : `${op} ${ln.join(' ')}`; };
function accessHTML(a) {
  if (!a) return '';
  const st = `<b>${esc(a.st)}駅</b><small>（${esc(a.lines.slice(0, 2).map(lineName).join('・'))}${a.lines.length > 2 ? 'ほか' : ''}）</small>`;
  const how = a.mode === 'at' ? `${st}の駅前、「${esc(a.stop)}」バス停から乗れます`
    : a.mode === 'walk' ? `${st}から歩いて約 ${a.min} 分で「${esc(a.stop)}」バス停`
    : a.mode === 'transfer' ? `${st}前の「${esc(a.vstop)}」から同じコミバスの「${esc(a.via)}」に乗り、「${esc(a.xstop)}」で乗り換え`
    : `近くの駅は${st}。「${esc(a.stop)}」バス停まで約 ${(a.d / 1000).toFixed(1)}km（歩くには遠い）`;
  return `<dt>アクセス</dt><dd>${how}</dd>`;
}

// 路線の概要（右の欄）。代表の日（2026-11-04 水曜・11-07 土曜・11-08 日曜）の便の数と、始発・終発
const DAY0 = new Date('2026-11-01T00:00:00');
const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
function routeStats(card, F) {
  const rs = new Set(card.rs), trips = F.trips.filter((t) => rs.has(t[0]));
  const on = (iso) => {
    const i = Math.round((new Date(iso + 'T00:00:00') - DAY0) / 864e5), code = F.days.charCodeAt(i) - 48;
    const sv = new Set(F.pats[code] || []);
    return trips.filter((t) => sv.has(t[1]));
  };
  const wd = on('2026-11-04'), sa = on('2026-11-07'), su = on('2026-11-08');
  const span = (ts) => ts.length ? `${hm(Math.min(...ts.map((t) => t[2])))}〜${hm(Math.max(...ts.map((t) => t[2])))}` : '';
  return { wd: wd.length, sa: sa.length, su: su.length, span: span(wd.length ? wd : sa.length ? sa : su) };
}

async function fillCard(el, card) {
  const [, F, S, A] = await Promise.all([loadSpotArt(), getJSON(`data/f/${card.k}.json`), getJSON(`data/s/${card.k}.json`), getJSON('data/access.json').catch(() => ({}))]);
  const m = el.querySelector('.map');
  m.innerHTML = mapSVG(card, F, S[String(card.rs[0])] || [], BOX_W, BOX_H - BOX_T, A[card.id]);
  runBus(m);
}


// 大きく見る。横に余裕があれば、カードを画面の高さの 8 割にして、沿線のスポットを右に並べる。
// 狭い画面（スマホの縦）は、カードを幅いっぱいにして、スポットを下に並べる。
const SIDE_MIN = 300;  // 右の欄の最小の幅
function layoutModal() {
  const box = $('#modal-in .big');
  if (!box) return;
  const W = window.innerWidth, H = window.innerHeight;
  const kH = H * 0.8 / BOX_H;  // 画面の高さの 8 割（いっぱいだと圧迫感がある。2026-11-03 ユーザー指示）
  const side = W - BOX_W * Math.min(kH, 1) - 60 >= SIDE_MIN;
  const k = side ? Math.min(kH, (W - 60 - SIDE_MIN) / BOX_W) : Math.min((W - 24) / BOX_W, kH);
  $('#modal-in').classList.toggle('side', side);
  box.style.setProperty('--s', k);
  box.firstElementChild.style.setProperty('--s', k);
}
window.addEventListener('resize', layoutModal);

async function openModal(card) {
  await loadSpotArt();
  const [F, S0, A] = await Promise.all([getJSON(`data/f/${card.k}.json`), getJSON(`data/s/${card.k}.json`), getJSON('data/access.json').catch(() => ({}))]);
  const S = S0[String(card.rs[0])] || [], st = routeStats(card, F);
  const fare = card.fare_max && card.fare_max !== card.fare ? `${card.fare}円～${card.fare_max}円` : `${card.fare}円`;
  const days = st.wd || st.sa || st.su ? `平日 ${st.wd} 便・土曜 ${st.sa} 便・日曜 ${st.su} 便` : '代表の日（11 月 4〜8 日）の運行なし';
  $('#modal-in').innerHTML = `<div class="big"><div class="scale">${cardHTML(card)}</div></div>
    <div class="info">
      <dl class="stat">
        ${accessHTML(A[card.id])}
        <dt>運行</dt><dd>${esc(card.org)}「${esc(card.op)}」</dd>
        <dt>運賃</dt><dd>${fare}</dd>
        <dt>長さ</dt><dd>${card.km}km</dd>
        <dt>バス停</dt><dd>${card.nstops} か所${card.km >= 1 ? `（1km に ${(card.nstops / card.km).toFixed(1)} か所）` : ''}</dd>
        <dt>便の数</dt><dd>${days}${card.alt ? '<br><small>データの期間外のため、期間内の同じ曜日で数えています</small>' : ''}</dd>
        ${st.span ? `<dt>始発〜終発</dt><dd>${st.span}（出発の時刻）</dd>` : ''}
        ${card.loop ? '<dt>形</dt><dd>始点と終点が同じ便があります（循環）</dd>' : ''}
      </dl>
      ${S.length ? `<h3>沿線のスポット</h3><ul>${S.map((s) => `<li><svg viewBox="0 0 64 64">${spotIcon(s)}</svg><span>${esc(s[1])} <small>${CAT_LABEL[s[0]]}</small></span></li>`).join('')}</ul>` : ''}
      <p class="lic">${esc(card.org)}「${esc(card.op)}」の GTFS（${esc(card.from)}〜${esc(card.to)}、${card.license_url ? `<a href="${esc(card.license_url)}">${esc(card.license)}</a>` : esc(card.license || 'ライセンス表記なし')}）${card.page ? `／<a href="${esc(card.page)}">配布ページ</a>` : ''}。
        ${card.est ? '経路の形は公開されていないため、バス停の間を OpenStreetMap の道路で経路探索して描いています（推定）。' : ''}</p>
    </div>`;
  layoutModal();
  $('#modal').hidden = false;
  fillCard($('#modal-in'), card);
}
// どこを押しても閉じる（「とじる」「×」は置かない。2026-11-03 ユーザー指示）。出典などのリンクだけはそのまま開く
const closeModal = () => { $('#modal').hidden = true; $('#modal-in').innerHTML = ''; };
$('#modal').onclick = (e) => { if (!e.target.closest('a')) closeModal(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

