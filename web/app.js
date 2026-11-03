'use strict';
// コミバスガチャ: 全国のコミュニティバスの路線カードを、運賃の合計 500 円までで 3 枚引く。
// カードの絵の窓には、路線の形・バス停・沿線のスポットのイラスト・走るバスを描く。
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const BUDGET = 500, PICKS = 3;
const RARE_P = { SSR: 0.06, SR: 0.24, R: 0.70 };
const STARS = { SSR: '★★★★★', SR: '★★★★', R: '★★★' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 乱数（?seed= を付けると同じ結果。キャプチャ用）
let rnd = Math.random;
if (params.get('seed')) {
  let a = +params.get('seed') >>> 0;
  rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

let CARDS = [];
const cache = {};
const getJSON = (u) => (cache[u] = cache[u] || fetch(u).then((r) => r.json()));

// ---- 3 枚を引く。レア度を先に引き、その中から、残りの予算に収まるものを選ぶ
function draw() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const got = [];
    let left = BUDGET;
    for (let i = 0; i < PICKS; i++) {
      const need = (PICKS - i - 1) * 100;  // 残りの枚数のぶん、最低 100 円ずつ残す
      let x = rnd(), tier = 'R';
      for (const t of ['SSR', 'SR', 'R']) { if (x < RARE_P[t]) { tier = t; break; } x -= RARE_P[t]; }
      const pool = CARDS.filter((c) => c.rare === tier && c.fare <= left - need && !got.some((g) => g.k === c.k));
      if (!pool.length) break;
      const c = pick(pool);
      got.push(c); left -= c.fare;
    }
    if (got.length === PICKS) return got;
  }
  return [];
}

// ---- 絵の窓（SVG）
const TILE = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
const merc = (lat, lon) => { const r = lat * Math.PI / 180; return [(lon + 180) / 360, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2]; };
const LINE_COLOR = { SSR: '#8a4fd6', SR: '#e2483d', R: '#2c6fc0' };

function mapSVG(card, F, spots, W = 300, H = 332) {
  const rs = new Set(card.rs);
  let lines = F.shape.filter((l) => rs.has(l[0])).map((l) => l[1]);
  const trips = F.trips.filter((t) => rs.has(t[0]));
  if (!lines.length) lines = [trips[0][3].map((i) => [F.stops[i][1], F.stops[i][2]])];
  const stops = [...new Set(trips.flatMap((t) => t[3]))].map((i) => F.stops[i]);
  const pts = lines.flat().concat(spots.map((s) => [s[2], s[3]])).map((p) => merc(p[0], p[1]));
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
  const SZ = 44, BW = 50, BH = 56;
  const placed = [];
  const OFFS = [[0, -10], [22, -22], [-22, -22], [30, 6], [-30, 6], [0, 46], [36, -36], [-36, -36], [0, -44]];
  const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  let art = '';
  for (const sp of spots) {
    const [x, y] = P(sp[2], sp[3]);
    let best = null;
    for (const [dx, dy] of OFFS) {
      const ix = x + dx, iy = y + dy;  // iy は絵の足もと
      const box = [ix - BW / 2, iy - BH + 12, ix + BW / 2, iy + 12];
      const out = Math.max(0, -box[0]) + Math.max(0, box[2] - W) + Math.max(0, -box[1]) + Math.max(0, box[3] - H);
      const cost = placed.reduce((a, b) => a + overlap(box, b), 0) + out * 60 + Math.hypot(dx, dy) * .5;
      if (!best || cost < best.cost) best = { ix, iy, box, cost };
    }
    placed.push(best.box);
    const label = sp[1].length > 9 ? sp[1].slice(0, 8) + '…' : sp[1];
    art += `<g>${Math.hypot(best.ix - x, best.iy - y) > 14 ? `<path d="M${x.toFixed(1)} ${y.toFixed(1)} L${best.ix.toFixed(1)} ${(best.iy - 4).toFixed(1)}" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 2"/>` : ''}
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#ff8a00" stroke="${INK}" stroke-width="1.3"/>
      <svg x="${(best.ix - SZ / 2).toFixed(1)}" y="${(best.iy - SZ * .9).toFixed(1)}" width="${SZ}" height="${SZ}" viewBox="0 0 64 64" overflow="visible">${ICONS[sp[0]]}</svg>
      <text class="lbl" x="${best.ix.toFixed(1)}" y="${(best.iy + 9).toFixed(1)}" text-anchor="middle">${esc(label)}</text></g>`;
  }
  const busD = dOf(lines.slice().sort((a, b) => b.length - a.length)[0]);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
    <g class="bgmap">${tiles}</g>
    <path d="${d}" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${LINE_COLOR[card.rare]}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${art}
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

function cardHTML(card) {
  const nmc = card.name.length > 16 ? 'l' : card.name.length > 12 ? 'm' : '';
  return `<div class="card ${card.rare}">
    <div class="inner">
      <div class="head">
        <div class="gem"><b>${card.rare}</b></div>
        <div class="op"><small>No.${String(card.no).padStart(4, '0')}・${esc(card.pref)}</small><span>${esc(card.op)}</span></div>
        <div class="stars">${STARS[card.rare]}</div>
      </div>
      <div class="frame">${card.loop ? '<div class="type">ぐるっと循環</div>' : ''}<div class="map"></div></div>
      <div class="plate"><div class="nm ${nmc}">${esc(card.name)}</div><div class="sub">${esc(card.org)}・${card.nstops} のバス停をむすぶ</div></div>
      <div class="stats">
        <div class="st"><small>運賃</small><b>${card.fare}<i>円</i></b></div>
        <div class="st"><small>バス停</small><b>${card.nstops}</b></div>
        <div class="st"><small>長さ</small><b>${card.km}<i>km</i></b></div>
      </div>
    </div>
    <div class="holo"></div>
    ${card.rare !== 'R' ? `<i class="spark" style="left:-4px;top:58px;animation-delay:.2s"></i><i class="spark" style="right:-3px;top:190px;animation-delay:1.1s"></i>
      <i class="spark" style="left:22px;bottom:-4px;animation-delay:1.7s"></i><i class="spark" style="right:30px;top:-5px;animation-delay:.7s"></i>` : ''}
  </div>`;
}

async function fillCard(el, card) {
  const [F, S] = await Promise.all([getJSON(`data/f/${card.k}.json`), getJSON(`data/s/${card.k}.json`)]);
  const m = el.querySelector('.map');
  m.innerHTML = mapSVG(card, F, S[String(card.rs[0])] || []);
  runBus(m);
}

const BACK = `<div class="cardback"><div>${MACHINE.replace('class="machine"', 'class="machine" style="width:150px"')}</div></div>`;

// ---- 画面
function fit() {
  // 結果のカードの幅: 画面の幅から両端の 25px ずつを引いた幅（最大 340px）
  const row = $('#row');
  if (row) row.style.setProperty('--w', `${Math.min(340, row.clientWidth - 50)}px`);
  document.querySelectorAll('.slot').forEach((s) => {
    const k = s.clientWidth / 340;
    s.style.height = `${476 * k}px`;
    s.querySelectorAll('.scale').forEach((x) => x.style.setProperty('--s', k));
  });
}
window.addEventListener('resize', fit);

async function showResult(got) {
  $('#v-top').hidden = true; $('#v-result').hidden = false;
  const total = got.reduce((a, c) => a + c.fare, 0);
  $('#total').innerHTML = `運賃の合計 <b>${total} 円</b> / ${BUDGET} 円`;
  $('#row').innerHTML = got.map((c, i) => `<div class="slot" data-i="${i}">
      <div class="flipper"><div class="face front"><div class="scale">${cardHTML(c)}</div></div><div class="face back"><div class="scale">${BACK}</div></div></div></div>`).join('');
  $('#dots').innerHTML = got.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('');
  fit();
  $('#row').scrollLeft = 0;
  $('#row').onscroll = () => {
    const r = $('#row'), w = r.children[0].offsetWidth + 12;
    const i = Math.round(r.scrollLeft / w);
    [...$('#dots').children].forEach((d, j) => d.classList.toggle('on', j === i));
  };
  await Promise.all(got.map((c, i) => fillCard($('#row').children[i], c)));
  [...$('#row').children].forEach((s, i) => {
    setTimeout(() => s.classList.add('shown'), still ? 0 : 250 + i * 380);
    s.onclick = () => openModal(got[i]);
  });
  window.scrollTo({ top: 0 });
}

async function openModal(card) {
  const k = Math.min(1, (window.innerWidth - 24) / 340);
  const S = (await getJSON(`data/s/${card.k}.json`))[String(card.rs[0])] || [];
  $('#modal-in').innerHTML = `<div class="big" style="--s:${k}"><div class="scale" style="--s:${k}">${cardHTML(card)}</div></div>
    <div class="info">
      <h3>沿線のスポット</h3>
      ${S.length ? `<ul>${S.map((s) => `<li><svg viewBox="0 0 64 64">${ICONS[s[0]]}</svg><span>${esc(s[1])} <small>${CAT_LABEL[s[0]]}</small></span></li>`).join('')}</ul>` : '<p>バス停から 200m 以内に、載せられるスポットがありませんでした。</p>'}
      <p class="lic">${esc(card.org)}「${esc(card.op)}」の GTFS（${esc(card.from)}〜${esc(card.to)}、${card.license_url ? `<a href="${esc(card.license_url)}">${esc(card.license)}</a>` : esc(card.license || 'ライセンス表記なし')}）${card.page ? `／<a href="${esc(card.page)}">配布ページ</a>` : ''}。
        レア度は路線の長さで決めています（短いほどレア）。</p>
    </div>
    <button class="close" id="close">とじる</button>`;
  $('#modal').hidden = false;
  fillCard($('#modal-in'), card);
  $('#close').onclick = () => { $('#modal').hidden = true; $('#modal-in').innerHTML = ''; };
}
$('#modal').onclick = (e) => { if (e.target.id === 'modal') $('#close').click(); };

const wait = (ms) => new Promise((r) => setTimeout(r, still ? 0 : ms));
async function spin() {
  const got = draw();
  if (!got.length) return;
  // カードのデータを先に読み始めておく
  got.forEach((c) => { getJSON(`data/f/${c.k}.json`); getJSON(`data/s/${c.k}.json`); });
  $('#v-result').hidden = true; $('#v-top').hidden = false;
  const box = $('#machine-box');
  box.classList.remove('spin', 'out', 'open');
  void box.offsetWidth;
  $('#pull').disabled = true;
  box.classList.add('spin'); await wait(1300);
  const colors = ['#ff9eb0', '#7cc8f8', '#ffd75e', '#5fbf6f', '#9b6bb5'];
  const c = pick(colors);
  $('#drop').innerHTML = `<svg viewBox="-14 -14 28 28"><g class="lid"><path d="M-12 0 A12 12 0 0 1 12 0 Z" fill="${c}" stroke="${INK}" stroke-width="2"/></g>
    <path d="M-12 0 A12 12 0 0 0 12 0 Z" fill="#fff" stroke="${INK}" stroke-width="2"/></svg>`;
  box.classList.add('out'); await wait(800);
  box.classList.add('open'); await wait(520);
  $('#pull').disabled = false;
  box.classList.remove('spin', 'out', 'open');
  await showResult(got);
}

async function init() {
  $('#machine').innerHTML = MACHINE;
  CARDS = (await getJSON('data/cards.json')).cards;
  $('#count').textContent = `全国 ${CARDS.length} 枚のカード（${new Set(CARDS.map((c) => c.k)).size} の自治体のコミュニティバス）`;
  $('#pull').onclick = spin;
  $('#again').onclick = spin;
  if (params.get('auto')) spin();
}
init();
