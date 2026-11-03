'use strict';
// コミバスガチャ: 全国のコミュニティバス（均一運賃）から「きょう行って帰ってこられるバス停」を引き、
// 乗ったら図鑑にカードが入る。カードの表は時刻表から描いた模様、裏は路線の形と数字。

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const STORE = 'comibus-gacha-v1';
const STAY = 30;          // 行った先で過ごす最低の分
const DAY0 = 5 * 60, DAY1 = 24 * 60;  // 模様の横軸（5 時〜24 時）

let CARDS = [], BYKEY = {}, state = load();
const feedCache = {};

// ---- 乱数（?seed= を付けると同じ結果になる。キャプチャ用）
let rnd = Math.random;
if (params.get('seed')) {
  let a = +params.get('seed') >>> 0;
  rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function load() {
  try { return Object.assign({ drawn: {}, rode: {} }, JSON.parse(localStorage.getItem(STORE) || '{}')); }
  catch (e) { return { drawn: {}, rode: {} }; }
}
function save() { localStorage.setItem(STORE, JSON.stringify(state)); }

// ---- 日本時間の「きょう」と「いま」（?date=2026-11-04&t=540 で固定できる）
function jstNow() {
  const d = new Date(Date.now() + 9 * 3600e3);
  let date = d.toISOString().slice(0, 10), min = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (params.get('date')) date = params.get('date');
  if (params.get('t')) min = +params.get('t');
  return { date, min };
}
const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const RARE = { 3: 'レア', 2: 'ややレア', 1: 'ふつう' };

async function feed(k) {
  if (!feedCache[k]) feedCache[k] = fetch(`data/f/${k}.json`).then((r) => r.json());
  return feedCache[k];
}

// その日に動く service の集合。範囲外の日は、範囲内の同じ曜日で代える
function services(F, date) {
  const d0 = new Date(F.start + 'T00:00:00Z'), d = new Date(date + 'T00:00:00Z');
  let i = Math.round((d - d0) / 864e5);
  const n = F.days.length;
  if (i < 0) i = ((i % 7) + 7) % 7;
  if (i >= n) i = n - 7 + ((i - (n - 7)) % 7);
  return new Set(F.pats[F.days.charCodeAt(i) - 48]);
}

// 便を「停留所の並び」「到着」「出発」に開く
function expand(tr) {
  const [r, sv, t0, s, ts] = tr;
  return { r, sv, s, arr: s.map((_, i) => t0 + ts[2 * i]), dep: s.map((_, i) => t0 + ts[2 * i + 1]) };
}

// ---- ガチャ: 1 つのフィードで、行って帰れる行き先を集める
function candidates(F, card, date, from, rule) {
  const sv = services(F, date);
  const trips = F.trips.filter((t) => sv.has(t[1])).map(expand);
  const hub = F.stops.findIndex((s) => s[0] === card.hub);
  if (hub < 0 || !trips.length) return [];
  const best = new Map();  // 行き先 → いちばん早く帰れる組み合わせ
  for (const o of trips) {
    const i = o.s.indexOf(hub);
    if (i < 0 || o.dep[i] < from) continue;
    for (let j = i + 1; j < o.s.length; j++) {
      const dst = o.s[j];
      if (dst === hub) break;
      if (rule === 'end' && j !== o.s.length - 1) continue;
      const a = o.arr[j];
      let back = null;
      for (const b of trips) {
        const p = b.s.indexOf(dst);
        if (p < 0 || b.dep[p] < a + STAY) continue;
        const q = b.s.indexOf(hub, p + 1);
        if (q < 0) continue;
        if (!back || b.arr[q] < back.end) back = { trip: b, p, q, end: b.arr[q] };
      }
      if (!back) continue;
      if (rule === '2h' && back.end - o.dep[i] > 120) continue;
      const c = { dst, out: o, i, j, back, start: o.dep[i] };
      const prev = best.get(dst);
      // 同じ行き先なら、出発が早いほう（待たずに乗れる）
      if (!prev || c.start < prev.start) best.set(dst, c);
    }
  }
  return [...best.values()];
}

async function pull() {
  const budget = +$('#budget').value, pref = $('#pref').value, rule = $('#rule').value;
  const now = jstNow();
  let from = $('#when').value === 'now' ? now.min : +$('#when').value;
  const pool = shuffle(CARDS.filter((c) => !c.yoyaku && c.fare * 2 <= budget && (!pref || c.pref === pref)));
  const box = $('#result');
  if (!pool.length) { box.innerHTML = '<p class="msg">この条件に合うコミバスがありません。予算を上げるか、地域を広げてください。</p>'; return; }
  box.innerHTML = '<p class="msg">引いています…</p>';
  $('#pull').disabled = true;
  try {
    for (const tryFrom of [from, null]) {  // いまからで見つからなければ、あすの朝 9 時で引き直す
      let date = now.date, f = tryFrom;
      if (tryFrom === null) {
        const d = new Date(now.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1);
        date = d.toISOString().slice(0, 10); f = 540;
      }
      for (const card of pool.slice(0, 40)) {
        const F = await feed(card.k);
        const cs = candidates(F, card, date, f, rule);
        if (cs.length) {
          const c = pick(cs);
          state.drawn[card.k] = state.drawn[card.k] || Date.now();
          save();
          showResult(card, F, c, date, tryFrom === null);
          updateCount();
          return;
        }
      }
    }
    box.innerHTML = '<p class="msg">この条件で行って帰ってこられるバス停が見つかりませんでした。しばりをゆるめてみてください。</p>';
  } finally { $('#pull').disabled = false; }
}

function showResult(card, F, c, date, tomorrow) {
  const S = F.stops, o = c.out, b = c.back.trip;
  const dst = S[c.dst], hubName = card.hub;
  const stay = b.dep[c.back.p] - o.arr[c.j];
  const total = c.back.end - c.start;
  const wd = '日月火水木金土'[new Date(date + 'T00:00:00Z').getUTCDay()];
  const rode = !!state.rode[card.k];
  const nstop = c.j - c.i;
  $('#result').innerHTML = `
    <div class="res">
      <div class="res-card">${cardHTML(card, F, true, true)}</div>
      <div class="trip">
        <p class="dest-lead">${tomorrow ? 'きょうはもう帰ってこられる便がないので、<b>あす</b>の朝で引きました。<br>' : ''}${esc(date.slice(5).replace('-', '/'))}（${wd}）、ここへ行ってきてください</p>
        <p class="dest">${esc(dst[0])}</p>
        <p class="where">${esc(card.pref)}・${esc(card.name)}</p>
        <ol class="legs">
          <li><span class="t">${hm(o.dep[c.i])}</span> <b>${esc(hubName)}</b> から乗る<small>${esc(F.routes[o.r])}</small></li>
          <li><span class="t">${hm(o.arr[c.j])}</span> <b>${esc(dst[0])}</b> で降りる<small>${nstop} 個先のバス停</small></li>
          <li class="stay">ここで ${stay} 分すごす</li>
          <li><span class="t">${hm(b.dep[c.back.p])}</span> <b>${esc(dst[0])}</b> から帰りの便<small>${esc(F.routes[b.r])}</small></li>
          <li><span class="t">${hm(c.back.end)}</span> <b>${esc(hubName)}</b> に戻る</li>
        </ol>
        <p class="sum">往復 <b>${card.fare * 2} 円</b>・全部で ${Math.floor(total / 60) ? Math.floor(total / 60) + ' 時間 ' : ''}${total % 60} 分</p>
        <p class="links"><a href="https://www.openstreetmap.org/?mlat=${dst[1]}&mlon=${dst[2]}#map=17/${dst[1]}/${dst[2]}" target="_blank" rel="noopener">降りるバス停の地図</a></p>
        <p class="note">出発の「${esc(hubName)}」は、このコミバスでいちばん多くの便が通るバス停です。
          時刻は ${esc(card.org)} の GTFS（${esc(card.from)}〜${esc(card.to)}）。${card.alt ? '<b>この時刻表は期間外のため、同じ曜日の時刻で代えています。</b>' : ''}乗る前に時刻表を確かめてください。</p>
        <div class="acts">
          <button id="rode" class="pull small" ${rode ? 'disabled' : ''}>${rode ? '図鑑に入っています' : '乗った！図鑑に入れる'}</button>
          <button id="again" class="sub">もう 1 回引く</button>
        </div>
      </div>
    </div>`;
  bindFlip($('#result'));
  $('#again').onclick = pull;
  $('#rode').onclick = () => {
    state.rode[card.k] = state.rode[card.k] || [];
    state.rode[card.k].push({ date, dst: dst[0] });
    save(); updateCount();
    $('#rode').textContent = '図鑑に入れました'; $('#rode').disabled = true;
    $('#result .card').classList.remove('gray');
  };
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- カード
function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function palette(card) {
  const h = hash(card.k) % 360;
  return { h, bg1: `hsl(${h} 45% 96%)`, bg2: `hsl(${(h + 40) % 360} 50% 90%)`, ink: `hsl(${h} 45% 22%)`,
    lines: [0, 50, 110, 200, 290].map((d) => `hsl(${(h + d) % 360} 62% 45%)`) };
}

// 模様: 代表の平日の便を、24 時間の時計の上に描く。
// 角度＝時刻（真上が 0 時、時計回り）、中心からの距離＝便がいちばん多いバス停からの距離。
// 出て戻る便が花びらになり、便の並びがそのまま路線ごとの模様になる。
function artSVG(card, F, W, H) {
  const P = palette(card);
  let sv = services(F, '2026-11-04');
  for (let i = 0; !F.trips.some((t) => sv.has(t[1])) && i < F.days.length; i++) {
    const d = new Date(F.start + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + i); sv = services(F, d.toISOString().slice(0, 10));
  }
  const hub = F.stops.findIndex((s) => s[0] === card.hub);
  const [hy, hx] = [F.stops[hub][1], F.stops[hub][2]];
  const dist = F.stops.map((s) => Math.hypot(s[1] - hy, (s[2] - hx) * Math.cos(hy * Math.PI / 180)));
  const md = Math.max(...dist.filter((x) => x < 1)) || 0.01;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 8, r0 = R * 0.16;
  const pt = (t, i) => {
    const a = (t / 1440) * 2 * Math.PI - Math.PI / 2, r = r0 + (Math.min(dist[i], md) / md) * (R - r0);
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  };
  let paths = '';
  for (const tr of F.trips) {
    if (!sv.has(tr[1])) continue;
    const e = expand(tr);
    let d = '';
    e.s.forEach((s, i) => {
      // 停留所のあいだは時刻を 3 つに割って曲線らしく
      if (i) for (const f of [1 / 3, 2 / 3]) {
        const t = e.dep[i - 1] + (e.arr[i] - e.dep[i - 1]) * f;
        const dd = dist[e.s[i - 1]] + (dist[s] - dist[e.s[i - 1]]) * f;
        const a = (t / 1440) * 2 * Math.PI - Math.PI / 2, r = r0 + (Math.min(dd, md) / md) * (R - r0);
        d += `L${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
      }
      d += `${i ? 'L' : 'M'}${pt(e.arr[i], s)}L${pt(e.dep[i], s)}`;
    });
    paths += `<path d="${d}" stroke="${P.lines[e.r % P.lines.length]}" />`;
  }
  const hours = [0, 6, 12, 18].map((h) => {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    return `<line x1="${cx + r0 * Math.cos(a)}" y1="${cy + r0 * Math.sin(a)}" x2="${cx + R * Math.cos(a)}" y2="${cy + R * Math.sin(a)}" class="tick"/>`
      + `<text x="${cx + (R + 1) * Math.cos(a)}" y="${cy + (R + 1) * Math.sin(a)}" class="hr" text-anchor="middle" dominant-baseline="middle">${h}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="art" aria-hidden="true">
    <circle cx="${cx}" cy="${cy}" r="${R}" class="ring"/><circle cx="${cx}" cy="${cy}" r="${r0}" class="ring"/>${hours}
    <g fill="none" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" opacity=".8" style="mix-blend-mode:multiply">${paths}</g></svg>`;
}

// 路線の形（注記なし）
function shapeSVG(card, W, H, stroke) {
  const pts = card.thumb.flat();
  if (!pts.length) return '';
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length, k = Math.cos(lat0 * Math.PI / 180);
  const xs = pts.map((p) => p[1] * k), ys = pts.map((p) => p[0]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min((W - 16) / (x1 - x0 || 1e-6), (H - 16) / (y1 - y0 || 1e-6));
  const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  const d = card.thumb.map((l) => l.map((p, i) => `${i ? 'L' : 'M'}${(ox + (p[1] * k - x0) * s).toFixed(1)} ${(H - oy - (p[0] - y0) * s).toFixed(1)}`).join('')).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="shape" aria-hidden="true"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function cardHTML(card, F, big, color) {
  const P = palette(card);
  const gray = !color && !state.rode[card.k];
  return `
  <div class="card r${card.rare} ${gray ? 'gray' : ''} ${big ? 'big' : ''}" data-k="${card.k}" tabindex="0" role="button" aria-label="${esc(card.name)} のカード（タップで裏返す）"
       style="--bg1:${P.bg1};--bg2:${P.bg2};--ink:${P.ink}">
    <div class="face front">
      <div class="top"><span class="no">No.${String(card.no).padStart(3, '0')}</span><span class="st" title="${RARE[card.rare]}">${stars(card.rare)}</span></div>
      <div class="art-box">${F ? artSVG(card, F, 260, 260) : ''}</div>
      <div class="nm ${card.name.length > 13 ? 'long' : ''}">${esc(card.name)}</div>
      <div class="meta">${esc(card.pref)}・${esc(card.agency || card.org)}</div>
      <div class="sub-line">${card.nstops} のバス停・${card.nroutes} 路線・最長 ${card.len} km</div>
      <div class="badges"><span class="fare">${card.fare} 円</span><span class="kei">${esc(card.kei)}</span></div>
    </div>
    <div class="face back">
      <div class="top"><span class="no">No.${String(card.no).padStart(3, '0')}</span><span class="st">${RARE[card.rare]}</span></div>
      <div class="nm-back">${esc(card.name)}</div>
      <div class="shape-box">${shapeSVG(card, 280, 200, P.ink)}</div>
      <dl class="facts">
        <dt>運賃</dt><dd>${card.fare} 円（均一）</dd>
        <dt>バス停</dt><dd>${card.nstops} か所</dd>
        <dt>路線</dt><dd>${card.nroutes} 本</dd>
        <dt>いちばん長い線</dt><dd>${card.len} km</dd>
        <dt>便がいちばん多いバス停</dt><dd>${esc(card.hub)}</dd>
      </dl>
      <p class="lic">形: ${card.shape ? '事業者の路線形状' : 'バス停を順につないだ線'}。データ: ${esc(card.org)}（${esc(card.license || 'ライセンス表記なし')}）／GTFSデータリポジトリ</p>
    </div>
  </div>`;
}

function bindFlip(root) {
  root.querySelectorAll('.card').forEach((el) => {
    const f = () => el.classList.toggle('flip');
    el.onclick = f;
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } };
  });
}

// ---- 図鑑
let keiFilter = '';
function updateCount() {
  const r = Object.keys(state.rode).length;
  $('#zukan-count').textContent = r ? `${r}` : '';
}
async function renderZukan() {
  const rode = Object.keys(state.rode).length, drawn = Object.keys(state.drawn).length;
  $('#zukan-head').innerHTML = `<p class="prog"><b>${rode}</b> / ${CARDS.length} 枚（乗った）・引いただけ ${Math.max(drawn - rode, 0)} 枚</p>
    <p class="hint">愛称の「系統」をそろえるのも楽しみ方の一つです。グレーのカードは、引いたけれどまだ乗っていないもの。</p>`;
  const keis = [...new Set(CARDS.map((c) => c.kei))];
  $('#kei-chips').innerHTML = ['', ...keis].map((k) => {
    const all = CARDS.filter((c) => !k || c.kei === k), got = all.filter((c) => state.rode[c.k]).length;
    return `<button class="chip ${k === keiFilter ? 'on' : ''}" data-k="${esc(k)}">${k || 'すべて'} <small>${got}/${all.length}</small></button>`;
  }).join('');
  $('#kei-chips').querySelectorAll('.chip').forEach((b) => { b.onclick = () => { keiFilter = b.dataset.k; renderZukan(); }; });
  // 持っているカード（乗った → 引いただけ）を先に、残りは番号順
  const has = (c) => (state.rode[c.k] ? 2 : state.drawn[c.k] ? 1 : 0);
  const list = CARDS.filter((c) => !keiFilter || c.kei === keiFilter).sort((x, y) => has(y) - has(x) || x.no - y.no);
  $('#grid').innerHTML = list.map((c) => {
    if (state.drawn[c.k] || state.rode[c.k]) return `<div class="slot has" data-k="${c.k}"><div class="mini" id="m-${c.k}"></div></div>`;
    return `<div class="slot"><span class="q">No.${String(c.no).padStart(3, '0')}</span><span class="qp">${esc(c.pref)}</span><span class="qs">${stars(c.rare)}</span></div>`;
  }).join('');
  const fit = () => $('#grid').querySelectorAll('.slot.has').forEach((s) => s.style.setProperty('--s', s.clientWidth / 300));
  fit(); window.onresize = fit;
  for (const c of list) {
    if (!(state.drawn[c.k] || state.rode[c.k])) continue;
    const F = await feed(c.k);
    const el = document.getElementById('m-' + c.k);
    if (el) el.innerHTML = cardHTML(c, F, false);
  }
  $('#grid').querySelectorAll('.slot.has').forEach((s) => {
    s.onclick = async () => {
      const c = BYKEY[s.dataset.k];
      $('#modal-card').innerHTML = cardHTML(c, await feed(c.k), true);
      bindFlip($('#modal-card'));
      $('#modal').hidden = false;
    };
  });
}

function view(v) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.v === v));
  $('#v-gacha').hidden = v !== 'gacha';
  $('#v-zukan').hidden = v !== 'zukan';
  if (v === 'zukan') renderZukan();
}

async function init() {
  const idx = await fetch('data/index.json').then((r) => r.json());
  CARDS = idx.cards; CARDS.forEach((c) => { BYKEY[c.k] = c; });
  const prefs = [...new Set(CARDS.filter((c) => !c.yoyaku).map((c) => c.pref))];
  $('#pref').innerHTML += prefs.map((p) => `<option>${esc(p)}</option>`).join('');
  $('#credit-list').innerHTML = CARDS.map((c) => `<li>${esc(c.org)}「${esc(c.name)}」— ${c.license_url ? `<a href="${esc(c.license_url)}">${esc(c.license)}</a>` : esc(c.license || '表記なし')}（${esc(c.from)}〜${esc(c.to)}）${c.page ? ` <a href="${esc(c.page)}">配布ページ</a>` : ''}</li>`).join('');
  $('#built').textContent = `データの作成日: ${idx.built}。均一運賃のコミュニティバス ${CARDS.length} 件を収録（予約が必要なもの ${CARDS.filter((c) => c.yoyaku).length} 件はガチャから外しています）。`;
  document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => view(t.dataset.v); });
  $('#pull').onclick = pull;
  $('#modal-close').onclick = () => { $('#modal').hidden = true; };
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; };
  for (const k of ['budget', 'pref', 'when', 'rule']) if (params.get(k)) $('#' + k).value = params.get(k);
  updateCount();
  if (params.get('view')) view(params.get('view'));
  if (params.get('auto')) pull();
}
init();
