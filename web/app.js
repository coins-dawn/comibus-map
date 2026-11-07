'use strict';
// 100円コミバスガチャ: どこまで乗っても 100 円のコミュニティバスの路線から 1 枚引く。card.js のあとに読む。
// （2026-11-07: 500 円で 3 枚のガチャはやめ、100 円だけにした。ユーザー指示）
const BUDGET = 100, PICKS = 1;
const ok100 = (c) => c.fare_max <= 100;
const RARE_P = { SSR: 0.06, SR: 0.24, R: 0.70 };

let CARDS = [];

// ---- 3 枚を引く。レア度を先に引き、その中から、残りの予算に収まるものを選ぶ
function draw() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const got = [];
    let left = BUDGET;
    for (let i = 0; i < PICKS; i++) {
      const need = (PICKS - i - 1) * 100;  // 残りの枚数のぶん、最低 100 円ずつ残す
      let x = rnd(), tier = 'R';
      for (const t of ['SSR', 'SR', 'R']) { if (x < RARE_P[t]) { tier = t; break; } x -= RARE_P[t]; }
      const pool = CARDS.filter((c) => c.rare === tier && ok100(c) && c.fare <= left - need && !got.some((g) => g.k === c.k));
      if (!pool.length) break;
      const c = pick(pool);
      got.push(c); left -= c.fare;
    }
    if (got.length === PICKS) return got;
  }
  return [];
}

const BACK = `<div class="cardback"><div>${MACHINE.replace('class="machine"', 'class="machine" style="width:150px"')}</div></div>`;

// ---- 画面
function fit() {
  // 結果のカードの幅: 画面の幅から両端の 25px ずつを引いた幅（最大 340px）
  const row = $('#row');
  if (row) row.style.setProperty('--w', `${Math.min(340, row.clientWidth - 50)}px`);
  document.querySelectorAll('.slot').forEach((s) => {
    const k = s.clientWidth / 340;
    // 枠の高さはカードの中身に合わせる（縦長のカードの 476px のままだと、地図のカードの下が空いた。2026-11-07）
    const inner = s.querySelector('.front .scale > *');
    s.style.height = `${(inner && inner.offsetHeight ? inner.offsetHeight : 476) * k}px`;
    s.querySelectorAll('.scale').forEach((x) => x.style.setProperty('--s', k));
  });
}
window.addEventListener('resize', fit);

async function showResult(got) {
  $('#v-top').hidden = true; $('#v-result').hidden = false;
  const total = got.reduce((a, c) => a + c.fare, 0);
  $('#total').innerHTML = `どこまで乗っても <b>100 円</b>`;
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
  fit();  // 中身が入ってから高さを合わせ直す
  [...$('#row').children].forEach((s, i) => {
    setTimeout(() => s.classList.add('shown'), still ? 0 : 250 + i * 380);
    s.onclick = () => openModal(got[i]);
  });
  window.scrollTo({ top: 0 });
}

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
  const pool = CARDS.filter(ok100);
  $('#count').textContent = `100 円で乗れるカード ${pool.length} 枚（${new Set(pool.map((c) => c.k)).size} の自治体）`;
  $('#pull').onclick = spin;
  $('#again').onclick = spin;
  if (params.get('auto')) spin();
}
init();
