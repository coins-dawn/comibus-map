'use strict';
// スポットごとのイラスト。icons.js のあとに読む。
// 1 枚 = 土台（種類ごとの建物や景色。選択肢つき）＋ 目印（そのスポットだけの特徴。しゃちほこ・りんご・将棋の駒…）＋ 右のキャラクター（種類ごとの動き）。
// 写真はなぞらない。説明文から「何があれば、そこだとわかるか」を決め、その目印を絵に入れる（実物に似ている必要はない）。
// 仕様は data/spotart.json: { スポットの番号: [土台, {選択肢}, [目印...]] }
const SA = (() => {
  const S = (w = 2) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;
  const ground = (x1 = 1, x2 = 36, y = 57) => `<path d="M${x1} ${y} H${x2}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;

  // ---- 右のキャラクター（種類ごと。icons.js の部品を使う）
  const person = (cx, color, arm = 'wave') => `<g>${legs(cx)}${body(cx, color)}${limb(`M${cx - 6} 37 L${cx - 9} 43`, SKIN)}
    ${arm === 'wave' ? `<g class="ic wave">${limb(`M${cx + 6} 37 L${cx + 10} 28`, SKIN)}</g>` : limb(`M${cx + 6} 37 L${cx + 9} 43`, SKIN)}
    ${head(cx, 21)}${face(cx, 21)}${mouth(cx, 27)}</g>`;
  const CHARA = {
    castle: () => person(50, '#e2483d'), jinja: () => prayer(50, '#7cc8f8'), tera: () => prayer(50, '#f7b733'),
    museum: () => person(50, '#9b6bb5'), michi: () => `<g class="ic hop">${person(50, '#f7b733', 'down')}</g>`, view: () => person(50, '#f7b733'),
    station: () => person(50, '#7cc8f8'), ferry: () => person(50, '#5fbf6f'), zoo: () => person(50, '#5fbf6f'), library: () => person(50, '#7cc8f8', 'down'),
    park: () => `<g class="ic hop">${person(50, '#ff9eb0')}</g>`, sky: () => person(50, '#e2483d'), beach: () => `<g class="ic hop">${person(50, '#e2483d')}</g>`,
  };

  // ---- 土台（左 0〜38 の範囲に描く）
  const roof = (x1, x2, y, h, c) => `<path d="M${x1} ${y} Q${(x1 + x2) / 2} ${y - h * .55} ${x2} ${y} L${x2 - 3} ${y - h} H${x1 + 3} Z" fill="${c}" ${S(1.8)}/>`;
  const BASE = {
    // お城: t=層の数(1-4) w=壁(white/black) r=屋根の色 ruin=城跡（石垣と旗だけ） gold=金の屋根
    castle: (o) => {
      if (o.ruin) return `<path d="M3 57 L7 40 H31 L35 57 Z" fill="#9aa3ad" ${S()}/><path d="M6 46 H32 M5 51 H33 M13 40 L12 57 M24 40 L25 57" stroke="#7e8894" stroke-width="1"/>
        <path d="M19 40 V14" stroke="${INK}" stroke-width="2"/><path d="M19 15 L32 19 L19 24 Z" fill="${o.flag || '#e2483d'}" ${S(1.6)}/>${o.sakura ? M.sakura(8, 30) : M.pine(9, 31)}`;
      const t = o.t || 3, wall = o.w === 'black' ? '#3d3d44' : '#fff', rc = o.gold ? '#f2c35a' : (o.r || '#3d4a5c');
      let g = `<path d="M4 57 L7 47 H31 L34 57 Z" fill="#9aa3ad" ${S()}/><path d="M6 52 H32" stroke="#7e8894" stroke-width="1"/>`;
      let y = 47;
      for (let i = 0; i < t; i++) {
        const w = 26 - i * 5, h = i === 0 ? 8 : 6.5, x = 19 - w / 2;
        g += `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${wall}" ${S(1.8)}/>`;
        if (i === 0) g += `<rect x="16" y="${y - 6}" width="2.2" height="3.2" fill="${o.w === 'black' ? '#fff' : INK}"/><rect x="20" y="${y - 6}" width="2.2" height="3.2" fill="${o.w === 'black' ? '#fff' : INK}"/>`;
        y -= h;
        g += roof(x - 3, x + w + 3, y + 1, 5, rc);
        y -= 3.5;
      }
      return g + (o.shachi ? M.shachi(19, y + 2) : '');
    },
    // 神社: c=鳥居の色(red/stone/white) n=鳥居の数 hall=社殿 shimenawa=しめ縄 big=大きな鳥居
    jinja: (o) => {
      const c = { red: '#e2483d', stone: '#b9b2a6', white: '#f4f1ea', wood: '#a8743f' }[o.c || 'red'];
      const torii = (x, s = 1) => `<g transform="translate(${x} ${57 - 39 * s}) scale(${s})">
        <path d="M0 3 Q15 -1 30 3 L29 6.5 Q15 3 1 6.5 Z" fill="${c}" ${S(2 / s)}/><rect x="3" y="10" width="24" height="3.2" fill="${c}" ${S(1.8 / s)}/>
        <rect x="6" y="5" width="3.6" height="34" fill="${c}" ${S(1.8 / s)}/><rect x="20.4" y="5" width="3.6" height="34" fill="${c}" ${S(1.8 / s)}/>
        ${o.shimenawa ? `<path d="M6 16 Q15 20 24 16" stroke="#e8d18a" stroke-width="2.6" fill="none"/><path d="M11 18 v4 M15 19 v4 M19 18 v4" stroke="#fff" stroke-width="1.6"/>` : ''}</g>`;
      let g = '';
      if (o.hall) g += `<rect x="18" y="38" width="18" height="12" fill="#f2e3c6" ${S(1.8)}/>${roof(15, 39, 39, 7, o.hallc || '#6b7a5c')}<path d="M18 50 H36" stroke="${INK}" stroke-width="1.6"/>`;
      if (o.n === 2) g += torii(12, .62) + torii(1, .78);
      else g += torii(o.hall ? 0 : 3, o.hall ? .8 : 1);
      return g + ground();
    },
    // お寺: pagoda=塔の層(0,3,5) gate=山門 bell=鐘 daibutsu=大仏
    tera: (o) => {
      let g = '';
      if (o.pagoda) {
        const n = o.pagoda;
        let y = 57;
        for (let i = 0; i < n; i++) { const w = 16 - i * 1.6; g += `<rect x="${12 - w / 2 + 2}" y="${y - 5}" width="${w - 4}" height="5" fill="#c9714a" ${S(1.4)}/>`; y -= 5; g += roof(12 - w / 2 - 1, 12 + w / 2 + 1, y + 1, 3.2, '#5c6878'); y -= 1.5; }
        g += `<path d="M12 ${y + 1} V${y - 7}" stroke="#f2c35a" stroke-width="2"/>`;
        g += `<rect x="22" y="44" width="14" height="13" fill="#f2e3c6" ${S(1.6)}/>${roof(19, 39, 45, 6, '#5c6878')}`;
      } else if (o.daibutsu) {
        g += `<ellipse cx="19" cy="52" rx="15" ry="6" fill="#8fa38a" ${S(1.8)}/><path d="M7 52 Q8 34 19 33 Q30 34 31 52 Z" fill="#8fa38a" ${S(1.8)}/>
          <circle cx="19" cy="27" r="7.5" fill="#8fa38a" ${S(1.8)}/><circle cx="19" cy="21" r="4" fill="#7d917a" ${S(1.4)}/><path d="M15.5 28 q1.5 1 3 0 M20.5 28 q1.5 1 3 0" stroke="${INK}" stroke-width="1.3" fill="none"/>
          <circle cx="19" cy="25" r=".9" fill="${INK}"/><path d="M13 45 Q19 41 25 45" stroke="${INK}" stroke-width="1.4" fill="none"/>`;
      } else {
        g += `<rect x="6" y="38" width="26" height="19" fill="#f2e3c6" ${S()}/><rect x="14" y="44" width="10" height="13" fill="#8a5a33" ${S(1.6)}/>
          <path d="M1 39 Q9 35 11 26 H27 Q29 35 37 39 Z" fill="${o.r || '#5c6878'}" ${S()}/><path d="M15 26 L19 20 L23 26" fill="#f7b733" ${S(1.6)}/>`;
      }
      if (o.bell) g += `<path d="M30 30 h6 v3 h-6 z" fill="#5c6878" ${S(1.2)}/><path d="M31 33 Q31 40 30 41 H36 Q35 40 35 33 Z" fill="#b98a3e" ${S(1.4)}/>`;
      return g + ground();
    },
    // 温泉: 湯船と人（右は空ける）。目印は奥に置く
    onsen: () => `<g class="ic steam"><path d="M14 28 q-3 -4 0 -8 q3 -4 0 -8" fill="none" stroke="#e2483d" stroke-width="2.2" stroke-linecap="round"/><path d="M26 25 q-3 -4 0 -8 q3 -4 0 -8" fill="none" stroke="#e2483d" stroke-width="2.2" stroke-linecap="round"/></g>
      <g class="ic bob">${head(22, 39)}${face(22, 39, 'closed')}<rect x="16" y="27" width="12" height="4.5" rx="2" fill="#fff" stroke="${INK}" stroke-width="1.5"/></g>
      <path d="M2 45 H60 L56 58 H6 Z" fill="#c98b4f" ${S()}/><path d="M3 46 Q17 43 31 46 T59 46" fill="#9fdcff" ${S(1.6)}/><path d="M7 52 H55" stroke="#e7b27c" stroke-width="1.6"/>`,
    // 博物館・資料館: k=建物(classic/kura/house/modern/minka) 目印は前に置く
    museum: (o) => {
      const k = o.k || 'classic';
      if (k === 'kura') return `<rect x="5" y="30" width="28" height="27" fill="#fff" ${S()}/><path d="M5 47 H33 V57 H5 Z" fill="#3d3d44"/><path d="M5 50 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3" stroke="#fff" stroke-width="1" fill="none"/>
        ${roof(1, 37, 31, 8, '#3d3d44')}<rect x="15" y="36" width="8" height="7" fill="#3d3d44" ${S(1.4)}/>${ground()}`;
      if (k === 'house') return `<rect x="6" y="34" width="26" height="23" fill="#f6efe1" ${S()}/><path d="M2 35 L19 21 L36 35 Z" fill="#c9714a" ${S()}/>
        <rect x="10" y="39" width="6" height="7" fill="#bfe6ff" ${S(1.4)}/><rect x="22" y="39" width="6" height="7" fill="#bfe6ff" ${S(1.4)}/><rect x="16" y="48" width="6" height="9" fill="#8a5a33" ${S(1.4)}/>${ground()}`;
      if (k === 'minka') return `<path d="M1 40 L19 18 L37 40 Z" fill="#c9a86a" ${S()}/><path d="M8 32 L19 22 L30 32" stroke="#a8874c" stroke-width="1.4" fill="none"/>
        <rect x="5" y="40" width="28" height="17" fill="#f2e3c6" ${S()}/><rect x="15" y="45" width="8" height="12" fill="#8a5a33" ${S(1.4)}/>${ground()}`;
      if (k === 'modern') return `<rect x="3" y="34" width="32" height="23" rx="2" fill="#e8eef4" ${S()}/><path d="M3 34 Q19 24 35 34" fill="#7cc8f8" ${S()}/>
        <path d="M7 41 H31 M7 47 H31" stroke="#b9c3d0" stroke-width="2"/><rect x="15" y="49" width="8" height="8" fill="#5c6878" ${S(1.4)}/>${ground()}`;
      return `<path d="M2 33 L19 23 L36 33 Z" fill="#f2e3c6" ${S()}/><rect x="4" y="33" width="30" height="3" fill="#f2e3c6" ${S(1.6)}/>
        <path d="M8 36 V54 M15 36 V54 M23 36 V54 M30 36 V54" stroke="${INK}" stroke-width="2.6"/><path d="M8 36 V54 M15 36 V54 M23 36 V54 M30 36 V54" stroke="#fff" stroke-width="1"/>
        <rect x="3" y="54" width="32" height="3" fill="#f2e3c6" ${S(1.6)}/>`;
    },
    // 道の駅: 屋根の下の売り場。目印（特産品）を台に並べる
    michi: (o) => `<rect x="4" y="36" width="30" height="21" fill="#f6efe1" ${S()}/><path d="M1 37 L6 28 H32 L37 37 Z" fill="${o.r || '#5fbf6f'}" ${S()}/>
      <path d="M6 33 H32" stroke="#fff" stroke-width="1.4"/><rect x="11" y="27" width="16" height="5" rx="1" fill="#fff" ${S(1.2)}/><path d="M14 29.5 h10" stroke="${INK}" stroke-width="1.2"/>
      <path d="M6 48 H32 V57 H6 Z" fill="#d89548" ${S(1.6)}/>${ground()}`,
    // 景色: k=mountain/gorge/sea/pond/rock/field/site
    view: (o) => {
      const k = o.k || 'mountain';
      if (k === 'gorge') return `<path d="M0 57 L0 22 L10 18 L15 57 Z" fill="#a5dc8f" ${S()}/><path d="M38 57 L38 24 L27 20 L22 57 Z" fill="#a5dc8f" ${S()}/>
        <path d="M15 57 Q19 40 22 57 Z" fill="#7cc8f8" ${S(1.6)}/><path d="M4 30 l3 -2 M30 32 l4 -2" stroke="#5fbf6f" stroke-width="2"/>${o.autumn ? M.maple(8, 26) : ''}`;
      if (k === 'sea') return `<path d="M0 44 Q19 40 38 44 V57 H0 Z" fill="#7cc8f8" ${S(1.8)}/><path d="M4 49 q3 -2 6 0 t6 0 M18 53 q3 -2 6 0 t6 0" stroke="#fff" stroke-width="1.6" fill="none"/>
        <path d="M2 44 L8 26 L16 30 L20 44 Z" fill="#b9a68a" ${S(1.8)}/>`;
      if (k === 'pond') return `<ellipse cx="19" cy="51" rx="17" ry="6" fill="#7cc8f8" ${S(1.8)}/><path d="M9 51 h6 M21 53 h7" stroke="#fff" stroke-width="1.4"/>${M.pine(30, 46)}`;
      if (k === 'rock') return `<path d="M3 57 L6 34 L14 24 L26 26 L33 40 L35 57 Z" fill="#b9a68a" ${S()}/><path d="M12 34 L17 44 M24 32 L22 46" stroke="#8a7a62" stroke-width="1.6"/>
        <path d="M0 57 q4 -3 8 0 t8 0 t8 0 t8 0" stroke="#7cc8f8" stroke-width="2.4" fill="none"/>`;
      if (k === 'field') return `<path d="M0 57 V42 Q19 36 38 42 V57 Z" fill="#c9d96a" ${S(1.8)}/><path d="M4 48 H34 M2 53 H36" stroke="#9cb33e" stroke-width="1.6"/>`;
      if (k === 'site') return `<path d="M0 57 Q19 47 38 57 Z" fill="#a5dc8f" ${S(1.8)}/><rect x="11" y="32" width="16" height="20" rx="1" fill="#f2e3c6" ${S(1.8)}/><path d="M14 38 H24 M14 42 H24 M14 46 H22" stroke="${INK}" stroke-width="1.4"/>`;
      return `<path d="M0 57 L14 26 L22 38 L28 30 L38 57 Z" fill="#8fbf7a" ${S()}/><path d="M11 33 L14 26 L17 33 Q14 31 11 33 Z" fill="#fff" ${S(1.2)}/>`;
    },
    // 駅: c=電車の色 sl=蒸気機関車 one=1 両のローカル線
    station: (o) => o.sl ? M.sl(19, 50, 1.25) + ground(0, 38, 57)
      : `<path d="M0 57 H38" stroke="${INK}" stroke-width="2"/><rect x="2" y="30" width="34" height="24" rx="6" fill="${o.c || '#5fbf6f'}" ${S(2.2)}/>
      <rect x="6" y="34" width="9" height="8" rx="1.5" fill="#bfe6ff" ${S(1.4)}/><rect x="17" y="34" width="9" height="8" rx="1.5" fill="#bfe6ff" ${S(1.4)}/><rect x="28" y="34" width="5" height="8" rx="1.5" fill="#bfe6ff" ${S(1.4)}/>
      <path d="M2 46 H36" stroke="${o.band || '#fff'}" stroke-width="2.4"/><circle cx="8" cy="54.5" r="2.6" fill="#5c6878" ${S(1.4)}/><circle cx="30" cy="54.5" r="2.6" fill="#5c6878" ${S(1.4)}/>`,
    // 船: k=ferry（定期船）/ boat（渡し・小舟）
    ferry: (o) => (o.k === 'boat' ? `<path d="M2 48 H36 Q33 56 26 56 H11 Q4 56 2 48 Z" fill="#c98b4f" ${S()}/><path d="M24 48 L30 22" stroke="${INK}" stroke-width="2"/>`
      : `<path d="M1 44 H37 L33 55 H6 Z" fill="${o.c || '#fff'}" ${S()}/><path d="M3 49 H35" stroke="${o.band || '#2c6fc0'}" stroke-width="2.4"/>
        <rect x="9" y="33" width="18" height="11" rx="1.5" fill="#fff" ${S(1.8)}/><rect x="12" y="36" width="4" height="4" fill="#bfe6ff" ${S(1)}/><rect x="19" y="36" width="4" height="4" fill="#bfe6ff" ${S(1)}/>
        <rect x="15" y="26" width="5" height="7" fill="${o.band || '#2c6fc0'}" ${S(1.4)}/>`)
      + `<path d="M0 59 q4 -3 8 0 t8 0 t8 0 t8 0 t8 0" fill="none" stroke="#7cc8f8" stroke-width="2.2" stroke-linecap="round"/>`,
    // 動物園: 目印の動物を大きく（土台は柵だけ）
    zoo: () => `<path d="M0 50 H38 M0 55 H38" stroke="#a8743f" stroke-width="2"/><path d="M3 46 V58 M13 46 V58 M23 46 V58 M33 46 V58" stroke="#a8743f" stroke-width="2.4"/>`,
    library: () => `<rect x="4" y="34" width="30" height="23" fill="#f6efe1" ${S()}/><path d="M1 35 L19 24 L37 35 Z" fill="#7cc8f8" ${S()}/>
      <path d="M8 40 V54 M12 40 V54 M16 40 V54 M22 40 V54 M26 40 V54 M30 40 V54" stroke="#9b6bb5" stroke-width="2.6"/><path d="M6 54 H32" stroke="${INK}" stroke-width="1.4"/>`,
    park: () => `<rect x="15" y="42" width="5" height="15" fill="#8a5a33" ${S(1.8)}/><circle cx="17.5" cy="32" r="12" fill="#5fbf6f" ${S()}/>${ground()}`,
    sky: (o) => o.plane || o.heli ? `<path d="M0 57 H38" stroke="#9aa3ad" stroke-width="4"/><path d="M4 57 h6 M16 57 h6 M28 57 h6" stroke="#fff" stroke-width="1.2"/>${o.heli ? M.heli(18, 50) : M.plane(19, 44)}`
      : `<path d="M2 40 Q19 35 36 38 L36 40 Q19 38 2 43 Z" fill="#fff" ${S(1.8)}/><path d="M6 46 Q18 41 30 44 Q31 47 28 47 L10 49 Q5 49 6 46 Z" fill="#fff" ${S(1.8)}/>`,
    beach: () => `<path d="M0 50 Q19 46 38 50 V58 H0 Z" fill="#f2deaa" ${S(1.8)}/><path d="M0 44 Q19 41 38 44 V49 Q19 46 0 49 Z" fill="#7cc8f8"/>`,
  };

  // ---- 目印（x, y は足もとの中央。だいたい 14〜20px）
  const M = {
    shachi: (x, y) => `<path d="M${x - 9} ${y} q-3 -5 0 -8 q2 3 3 4 M${x + 9} ${y} q3 -5 0 -8 q-2 3 -3 4" stroke="#f2c35a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M${x - 9} ${y} q-3 -5 0 -8 q2 3 3 4 M${x + 9} ${y} q3 -5 0 -8 q-2 3 -3 4" stroke="${INK}" stroke-width=".9" fill="none"/>`,
    pine: (x, y) => `<rect x="${x - 1.2}" y="${y - 6}" width="2.4" height="6" fill="#8a5a33"/><path d="M${x - 7} ${y - 6} Q${x} ${y - 12} ${x + 7} ${y - 6} Z M${x - 5} ${y - 10} Q${x} ${y - 16} ${x + 5} ${y - 10} Z" fill="#3f8f4f" ${S(1.2)}/>`,
    sakura: (x, y) => `<rect x="${x - 1.2}" y="${y - 6}" width="2.4" height="6" fill="#8a5a33"/><circle cx="${x}" cy="${y - 11}" r="7" fill="#ffc3d6" ${S(1.2)}/><circle cx="${x - 3}" cy="${y - 12}" r="1.2" fill="#fff"/><circle cx="${x + 3}" cy="${y - 9}" r="1.2" fill="#fff"/>`,
    maple: (x, y) => `<path d="M${x} ${y - 8} l2 4 4 -1 -2 4 3 2 -5 1 v3 h-4 v-3 l-5 -1 3 -2 -2 -4 4 1 z" fill="#e2483d" ${S(1)}/>`,
    apple: (x, y) => `<circle cx="${x}" cy="${y - 6}" r="6" fill="#e2483d" ${S(1.6)}/><path d="M${x} ${y - 12} q1 -3 3 -3" stroke="${INK}" stroke-width="1.4" fill="none"/><path d="M${x + 1} ${y - 12} q4 -3 6 0 q-3 2 -6 0" fill="#5fbf6f" ${S(1)}/>`,
    grape: (x, y) => [[0, -14], [-3, -10], [3, -10], [-5, -6], [0, -6], [5, -6], [-2, -2], [2, -2]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="2.6" fill="#7b4fa8" ${S(1)}/>`).join('') + `<path d="M${x} ${y - 16} q2 -3 5 -2" stroke="#5fbf6f" stroke-width="1.6" fill="none"/>`,
    peach: (x, y) => `<path d="M${x} ${y} Q${x - 7} ${y - 3} ${x - 6} ${y - 9} Q${x - 4} ${y - 14} ${x} ${y - 12} Q${x + 4} ${y - 14} ${x + 6} ${y - 9} Q${x + 7} ${y - 3} ${x} ${y} Z" fill="#ffb3b3" ${S(1.4)}/><path d="M${x} ${y - 12} q-3 -4 -6 -3 q2 3 6 3" fill="#5fbf6f" ${S(1)}/>`,
    cherry: (x, y) => `<circle cx="${x - 3}" cy="${y - 3}" r="3" fill="#e2483d" ${S(1.2)}/><circle cx="${x + 3}" cy="${y - 2}" r="3" fill="#e2483d" ${S(1.2)}/><path d="M${x - 3} ${y - 6} Q${x} ${y - 14} ${x + 2} ${y - 14} M${x + 3} ${y - 5} Q${x + 3} ${y - 11} ${x + 2} ${y - 14}" stroke="#3f8f4f" stroke-width="1.3" fill="none"/>`,
    strawberry: (x, y) => `<path d="M${x} ${y} Q${x - 7} ${y - 6} ${x - 5} ${y - 10} H${x + 5} Q${x + 7} ${y - 6} ${x} ${y} Z" fill="#e2483d" ${S(1.4)}/><path d="M${x - 5} ${y - 10} l2 -3 2 2 1 -3 1 3 2 -2 2 3 z" fill="#5fbf6f" ${S(1)}/><circle cx="${x - 2}" cy="${y - 6}" r=".7" fill="#fff"/><circle cx="${x + 2}" cy="${y - 5}" r=".7" fill="#fff"/>`,
    melon: (x, y) => `<circle cx="${x}" cy="${y - 7}" r="7" fill="#a5dc8f" ${S(1.4)}/><path d="M${x - 5} ${y - 11} l10 8 M${x + 5} ${y - 11} l-10 8 M${x - 7} ${y - 7} h14" stroke="#e8f5d8" stroke-width="1"/><path d="M${x} ${y - 14} v-3" stroke="${INK}" stroke-width="1.6"/>`,
    mikan: (x, y) => `<circle cx="${x}" cy="${y - 6}" r="6" fill="#ff9a1f" ${S(1.5)}/><path d="M${x} ${y - 12} q3 -2 5 0 q-3 2 -5 0" fill="#5fbf6f" ${S(1)}/>`,
    rice: (x, y) => `<path d="M${x} ${y} Q${x - 1} ${y - 10} ${x + 4} ${y - 16}" stroke="#c9a23e" stroke-width="1.6" fill="none"/>` + [0, 1, 2, 3, 4].map((i) => `<ellipse cx="${x + .5 + i * .8 + 2}" cy="${y - 7 - i * 2}" rx="1.6" ry="1" fill="#f2c35a" ${S(.6)}/>`).join(''),
    sunflower: (x, y) => `<path d="M${x} ${y} V${y - 9}" stroke="#3f8f4f" stroke-width="1.8"/>` + Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<ellipse cx="${(x + Math.cos(a) * 4.5).toFixed(1)}" cy="${(y - 13 + Math.sin(a) * 4.5).toFixed(1)}" rx="2.4" ry="1.4" transform="rotate(${i * 45} ${(x + Math.cos(a) * 4.5).toFixed(1)} ${(y - 13 + Math.sin(a) * 4.5).toFixed(1)})" fill="#ffd257" ${S(.7)}/>`; }).join('') + `<circle cx="${x}" cy="${y - 13}" r="3" fill="#8a5a33" ${S(1)}/>`,
    flower: (x, y, c = '#ff9eb0') => `<path d="M${x} ${y} V${y - 8}" stroke="#3f8f4f" stroke-width="1.6"/>` + [0, 72, 144, 216, 288].map((a) => `<circle cx="${(x + Math.cos(a * Math.PI / 180) * 3).toFixed(1)}" cy="${(y - 11 + Math.sin(a * Math.PI / 180) * 3).toFixed(1)}" r="2.4" fill="${c}" ${S(.8)}/>`).join('') + `<circle cx="${x}" cy="${y - 11}" r="1.6" fill="#ffd257"/>`,
    lavender: (x, y) => [-3, 0, 3].map((d) => `<path d="M${x + d} ${y} V${y - 12}" stroke="#3f8f4f" stroke-width="1.2"/><ellipse cx="${x + d}" cy="${y - 13}" rx="1.8" ry="4" fill="#9b6bb5" ${S(.7)}/>`).join(''),
    tea: (x, y) => `<path d="M${x - 6} ${y - 9} H${x + 6} L${x + 4} ${y} H${x - 4} Z" fill="#fff" ${S(1.4)}/><path d="M${x - 5} ${y - 7} H${x + 5}" stroke="#7aa83e" stroke-width="2"/><path d="M${x - 1} ${y - 11} q1 -2 0 -4" stroke="#b9c3d0" stroke-width="1.2" fill="none"/>`,
    sake: (x, y) => `<rect x="${x - 7}" y="${y - 13}" width="14" height="13" rx="3" fill="#c98b4f" ${S(1.5)}/><path d="M${x - 7} ${y - 9} H${x + 7} M${x - 7} ${y - 4} H${x + 7}" stroke="${INK}" stroke-width="1.2"/><rect x="${x - 4}" y="${y - 8}" width="8" height="5" fill="#fff" ${S(.8)}/><path d="M${x - 1.5} ${y - 6.5} h3 M${x} ${y - 7.5} v3" stroke="#e2483d" stroke-width=".9"/>`,
    soba: (x, y) => `<path d="M${x - 8} ${y - 8} H${x + 8} Q${x + 7} ${y} ${x} ${y} Q${x - 7} ${y} ${x - 8} ${y - 8} Z" fill="#e2483d" ${S(1.4)}/><path d="M${x - 6} ${y - 9} q3 -2 6 0 t6 0" stroke="#c9a86a" stroke-width="2" fill="none"/><path d="M${x + 2} ${y - 16} L${x + 8} ${y - 8} M${x + 4} ${y - 17} L${x + 9} ${y - 9}" stroke="#a8743f" stroke-width="1.2"/>`,
    fish: (x, y, c = '#7cc8f8') => `<path d="M${x - 8} ${y - 6} Q${x - 2} ${y - 12} ${x + 5} ${y - 6} Q${x - 2} ${y} ${x - 8} ${y - 6} Z M${x + 4} ${y - 6} L${x + 9} ${y - 10} V${y - 2} Z" fill="${c}" ${S(1.3)}/><circle cx="${x - 5}" cy="${y - 7}" r=".9" fill="${INK}"/>`,
    crab: (x, y) => `<ellipse cx="${x}" cy="${y - 5}" rx="7" ry="4.5" fill="#e2483d" ${S(1.4)}/><path d="M${x - 7} ${y - 6} q-3 -4 -1 -7 M${x + 7} ${y - 6} q3 -4 1 -7 M${x - 5} ${y - 2} l-4 3 M${x + 5} ${y - 2} l4 3" stroke="#e2483d" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="${x - 2}" cy="${y - 9}" r="1.1" fill="${INK}"/><circle cx="${x + 2}" cy="${y - 9}" r="1.1" fill="${INK}"/>`,
    oyster: (x, y) => `<path d="M${x - 8} ${y - 4} Q${x - 6} ${y - 12} ${x + 2} ${y - 11} Q${x + 9} ${y - 9} ${x + 7} ${y - 3} Q${x} ${y} ${x - 8} ${y - 4} Z" fill="#c9c2b4" ${S(1.4)}/><path d="M${x - 4} ${y - 5} q4 -4 8 -1" stroke="#8a8274" stroke-width="1" fill="none"/>`,
    squid: (x, y) => `<path d="M${x} ${y - 18} L${x + 5} ${y - 10} V${y - 4} H${x - 5} V${y - 10} Z" fill="#fff" ${S(1.3)}/><path d="M${x - 4} ${y - 4} v5 M${x - 1.5} ${y - 4} v6 M${x + 1.5} ${y - 4} v6 M${x + 4} ${y - 4} v5" stroke="${INK}" stroke-width="1.2"/><circle cx="${x - 2}" cy="${y - 7}" r=".9" fill="${INK}"/><circle cx="${x + 2}" cy="${y - 7}" r=".9" fill="${INK}"/>`,
    shogi: (x, y) => `<path d="M${x} ${y - 16} L${x + 6} ${y - 12} L${x + 7} ${y} H${x - 7} L${x - 6} ${y - 12} Z" fill="#f2d79b" ${S(1.4)}/><text x="${x}" y="${y - 3.5}" text-anchor="middle" font-size="8" font-weight="900" fill="${INK}">王</text>`,
    sl: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-13" y="-10" width="18" height="9" rx="2" fill="#3d3d44" ${S(1.4)}/><rect x="3" y="-15" width="9" height="14" fill="#3d3d44" ${S(1.4)}/><rect x="5" y="-13" width="5" height="4" fill="#ffd257"/>
      <rect x="-10" y="-15" width="3.5" height="5" fill="#3d3d44" ${S(1.2)}/><circle cx="-8" cy="1" r="3.2" fill="#e2483d" ${S(1.2)}/><circle cx="0" cy="1" r="3.2" fill="#e2483d" ${S(1.2)}/><circle cx="8" cy="1" r="3.2" fill="#e2483d" ${S(1.2)}/>
      <g class="ic steam"><path d="M-8 -17 q-3 -3 0 -6 q3 -3 0 -6" stroke="#b9c3d0" stroke-width="2" fill="none" stroke-linecap="round"/></g></g>`,
    horse: (x, y) => `<path d="M${x - 8} ${y - 8} H${x + 4} L${x + 8} ${y - 14} L${x + 10} ${y - 12} L${x + 6} ${y - 6} V${y - 4} H${x - 8} Z" fill="#a8743f" ${S(1.3)}/><path d="M${x - 7} ${y - 4} V${y} M${x - 3} ${y - 4} V${y} M${x + 1} ${y - 4} V${y} M${x + 5} ${y - 4} V${y}" stroke="${INK}" stroke-width="1.6"/><path d="M${x - 8} ${y - 8} q-3 1 -3 5" stroke="${INK}" stroke-width="1.4" fill="none"/>`,
    cow: (x, y) => `<rect x="${x - 9}" y="${y - 11}" width="15" height="8" rx="3" fill="#fff" ${S(1.3)}/><circle cx="${x - 4}" cy="${y - 8}" r="2" fill="${INK}"/><rect x="${x + 4}" y="${y - 14}" width="6" height="6" rx="2" fill="#fff" ${S(1.2)}/><path d="M${x - 7} ${y - 3} V${y} M${x + 4} ${y - 3} V${y}" stroke="${INK}" stroke-width="1.6"/>`,
    deer: (x, y) => `<ellipse cx="${x - 2}" cy="${y - 7}" rx="7" ry="4" fill="#c98b4f" ${S(1.3)}/><path d="M${x + 4} ${y - 9} L${x + 7} ${y - 15}" stroke="${INK}" stroke-width="3"/><circle cx="${x + 7}" cy="${y - 15}" r="2.4" fill="#c98b4f" ${S(1.2)}/><path d="M${x + 6} ${y - 17} l-2 -4 M${x + 8} ${y - 17} l2 -4" stroke="${INK}" stroke-width="1.2"/><path d="M${x - 6} ${y - 4} V${y} M${x + 2} ${y - 4} V${y}" stroke="${INK}" stroke-width="1.6"/>`,
    bear: (x, y) => `<circle cx="${x}" cy="${y - 7}" r="7" fill="#7a5233" ${S(1.4)}/><circle cx="${x - 5}" cy="${y - 13}" r="2.4" fill="#7a5233" ${S(1.2)}/><circle cx="${x + 5}" cy="${y - 13}" r="2.4" fill="#7a5233" ${S(1.2)}/><ellipse cx="${x}" cy="${y - 5}" rx="3" ry="2.2" fill="#e8c9a0"/><circle cx="${x - 2.5}" cy="${y - 8.5}" r=".9" fill="${INK}"/><circle cx="${x + 2.5}" cy="${y - 8.5}" r=".9" fill="${INK}"/>`,
    owl: (x, y) => `<ellipse cx="${x}" cy="${y - 7}" rx="6" ry="7" fill="#a8743f" ${S(1.4)}/><circle cx="${x - 2.4}" cy="${y - 9}" r="2.2" fill="#fff" ${S(.8)}/><circle cx="${x + 2.4}" cy="${y - 9}" r="2.2" fill="#fff" ${S(.8)}/><circle cx="${x - 2.4}" cy="${y - 9}" r=".9" fill="${INK}"/><circle cx="${x + 2.4}" cy="${y - 9}" r=".9" fill="${INK}"/><path d="M${x - 1} ${y - 6.5} L${x} ${y - 5} L${x + 1} ${y - 6.5} Z" fill="#f7b733"/>`,
    crane: (x, y) => `<path d="M${x - 9} ${y - 8} Q${x} ${y - 14} ${x + 6} ${y - 8} Q${x} ${y - 4} ${x - 9} ${y - 8} Z" fill="#fff" ${S(1.3)}/><path d="M${x + 4} ${y - 9} Q${x + 8} ${y - 16} ${x + 6} ${y - 19}" stroke="${INK}" stroke-width="1.6" fill="none"/><circle cx="${x + 6}" cy="${y - 19}" r="1.6" fill="#e2483d"/><path d="M${x - 2} ${y - 5} V${y} M${x + 1} ${y - 5} V${y}" stroke="${INK}" stroke-width="1.2"/><path d="M${x - 9} ${y - 8} l-2 2" stroke="${INK}" stroke-width="2"/>`,
    duck: (x, y) => `<path d="M${x - 8} ${y - 5} Q${x - 6} ${y} ${x + 4} ${y} Q${x + 8} ${y - 3} ${x + 4} ${y - 6} Z" fill="#fff" ${S(1.3)}/><circle cx="${x + 4}" cy="${y - 9}" r="3.4" fill="#3f8f4f" ${S(1.2)}/><path d="M${x + 7} ${y - 9} l3 1 -3 1" fill="#f7b733" ${S(.8)}/>`,
    penguin: (x, y) => `<ellipse cx="${x}" cy="${y - 8}" rx="6" ry="8" fill="#3d4a5c" ${S(1.4)}/><ellipse cx="${x}" cy="${y - 7}" rx="3.8" ry="5.6" fill="#fff"/><circle cx="${x - 2}" cy="${y - 11}" r=".9" fill="${INK}"/><circle cx="${x + 2}" cy="${y - 11}" r=".9" fill="${INK}"/><path d="M${x - 1} ${y - 9} L${x} ${y - 7.5} L${x + 1} ${y - 9} Z" fill="#f7b733"/>`,
    monkey: (x, y) => `<circle cx="${x}" cy="${y - 8}" r="7" fill="#a8743f" ${S(1.4)}/><ellipse cx="${x}" cy="${y - 7}" rx="4.6" ry="4" fill="#ffb3a3"/><circle cx="${x - 7}" cy="${y - 8}" r="2.2" fill="#ffb3a3" ${S(1)}/><circle cx="${x + 7}" cy="${y - 8}" r="2.2" fill="#ffb3a3" ${S(1)}/><circle cx="${x - 1.8}" cy="${y - 8}" r=".9" fill="${INK}"/><circle cx="${x + 1.8}" cy="${y - 8}" r=".9" fill="${INK}"/>`,
    giraffe: (x, y) => `<path d="M${x - 6} ${y} V${y - 8} H${x + 2} V${y - 18} H${x + 7} V${y - 15} H${x + 5} V${y - 8} V${y}" fill="#f2c35a" ${S(1.3)}/><circle cx="${x - 2}" cy="${y - 6}" r="1.2" fill="#a8743f"/><circle cx="${x + 3}" cy="${y - 13}" r="1.1" fill="#a8743f"/>`,
    dolphin: (x, y) => `<path d="M${x - 9} ${y - 4} Q${x - 4} ${y - 16} ${x + 7} ${y - 10} L${x + 10} ${y - 9} L${x + 7} ${y - 8} Q${x} ${y - 8} ${x - 6} ${y - 2} Z" fill="#7cc8f8" ${S(1.3)}/><path d="M${x - 1} ${y - 13} l2 -4 2 3" fill="#7cc8f8" ${S(1)}/>`,
    dino: (x, y) => `<path d="M${x - 10} ${y - 4} Q${x - 4} ${y - 8} ${x} ${y - 8} L${x + 3} ${y - 16} Q${x + 7} ${y - 18} ${x + 8} ${y - 14} L${x + 4} ${y - 12} L${x + 4} ${y - 4} Z" fill="#5fbf6f" ${S(1.3)}/><path d="M${x - 3} ${y - 5} V${y} M${x + 2} ${y - 5} V${y}" stroke="${INK}" stroke-width="1.8"/><circle cx="${x + 6}" cy="${y - 15}" r=".8" fill="${INK}"/>`,
    rocket: (x, y) => `<path d="M${x} ${y - 20} Q${x + 5} ${y - 14} ${x + 4} ${y - 4} H${x - 4} Q${x - 5} ${y - 14} ${x} ${y - 20} Z" fill="#fff" ${S(1.3)}/><circle cx="${x}" cy="${y - 12}" r="1.8" fill="#7cc8f8" ${S(.8)}/><path d="M${x - 4} ${y - 7} l-3 4 h3 M${x + 4} ${y - 7} l3 4 h-3" fill="#e2483d" ${S(1)}/><path d="M${x - 2} ${y - 3} q2 4 4 0" fill="#ff9a1f"/>`,
    star: (x, y) => `<path d="M${x} ${y - 16} l2.4 5 5.4 .6 -4 3.8 1.1 5.4 -4.9 -2.7 -4.9 2.7 1.1 -5.4 -4 -3.8 5.4 -.6 z" fill="#ffd257" ${S(1.2)}/>`,
    telescope: (x, y) => `<path d="M${x - 8} ${y - 10} L${x + 6} ${y - 16} L${x + 8} ${y - 12} L${x - 6} ${y - 6} Z" fill="#e8eef4" ${S(1.3)}/><path d="M${x} ${y - 9} L${x - 4} ${y} M${x} ${y - 9} L${x + 4} ${y}" stroke="${INK}" stroke-width="1.4"/>`,
    pot: (x, y, c = '#c9714a') => `<path d="M${x - 4} ${y - 15} H${x + 4} L${x + 3} ${y - 12} Q${x + 8} ${y - 8} ${x + 5} ${y} H${x - 5} Q${x - 8} ${y - 8} ${x - 3} ${y - 12} Z" fill="${c}" ${S(1.4)}/><path d="M${x - 5} ${y - 7} q5 2 10 0" stroke="#fff" stroke-width="1" fill="none" opacity=".7"/>`,
    dogu: (x, y) => `<ellipse cx="${x}" cy="${y - 13}" rx="5" ry="4" fill="#c9a86a" ${S(1.2)}/><path d="M${x - 3} ${y - 13} h2 M${x + 1} ${y - 13} h2" stroke="${INK}" stroke-width="1.3"/><path d="M${x - 5} ${y - 9} H${x + 5} L${x + 7} ${y - 5} H${x - 7} Z M${x - 4} ${y - 5} H${x + 4} L${x + 5} ${y} H${x - 5} Z" fill="#c9a86a" ${S(1.2)}/>`,
    kabuto: (x, y) => `<path d="M${x - 8} ${y - 3} Q${x - 8} ${y - 13} ${x} ${y - 13} Q${x + 8} ${y - 13} ${x + 8} ${y - 3} Z" fill="#3d3d44" ${S(1.3)}/><path d="M${x - 9} ${y - 3} H${x + 9} L${x + 7} ${y} H${x - 7} Z" fill="#3d3d44" ${S(1.2)}/><path d="M${x} ${y - 13} L${x - 6} ${y - 20} M${x} ${y - 13} L${x + 6} ${y - 20}" stroke="#f2c35a" stroke-width="2.2" stroke-linecap="round"/>`,
    sword: (x, y) => `<path d="M${x - 8} ${y - 2} Q${x} ${y - 10} ${x + 9} ${y - 18}" stroke="#b9c3d0" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M${x - 8} ${y - 2} Q${x} ${y - 10} ${x + 9} ${y - 18}" stroke="${INK}" stroke-width=".8" fill="none"/><path d="M${x - 6} ${y - 7} l4 4" stroke="#f2c35a" stroke-width="2.4"/><path d="M${x - 9} ${y} l3 -3" stroke="#3d3d44" stroke-width="3"/>`,
    frame: (x, y) => `<rect x="${x - 8}" y="${y - 16}" width="16" height="13" fill="#f2c35a" ${S(1.3)}/><rect x="${x - 6}" y="${y - 14}" width="12" height="9" fill="#bfe6ff"/><path d="M${x - 6} ${y - 5} L${x - 2} ${y - 10} L${x + 1} ${y - 7} L${x + 3} ${y - 9} L${x + 6} ${y - 5} Z" fill="#5fbf6f"/><path d="M${x} ${y - 3} V${y}" stroke="${INK}" stroke-width="1.4"/>`,
    statue: (x, y) => `<rect x="${x - 6}" y="${y - 4}" width="12" height="4" fill="#b9b2a6" ${S(1.2)}/><circle cx="${x}" cy="${y - 15}" r="3" fill="#b9b2a6" ${S(1.2)}/><path d="M${x - 4} ${y - 4} L${x - 3} ${y - 12} H${x + 3} L${x + 4} ${y - 4} Z" fill="#b9b2a6" ${S(1.2)}/>`,
    kokeshi: (x, y) => `<circle cx="${x}" cy="${y - 14}" r="4.4" fill="#ffe9cf" ${S(1.2)}/><path d="M${x - 4.4} ${y - 15} Q${x} ${y - 21} ${x + 4.4} ${y - 15} Z" fill="${INK}"/><rect x="${x - 3.6}" y="${y - 10}" width="7.2" height="10" rx="2" fill="#e2483d" ${S(1.2)}/><circle cx="${x}" cy="${y - 6}" r="1.6" fill="#ffd257"/>`,
    daruma: (x, y) => `<ellipse cx="${x}" cy="${y - 7}" rx="7" ry="7.5" fill="#e2483d" ${S(1.4)}/><ellipse cx="${x}" cy="${y - 9}" rx="4" ry="3.4" fill="#fff" ${S(1)}/><circle cx="${x - 1.5}" cy="${y - 9.5}" r=".9" fill="${INK}"/><circle cx="${x + 1.5}" cy="${y - 9.5}" r=".9" fill="${INK}"/>`,
    lantern: (x, y) => `<path d="M${x} ${y - 20} V${y - 17}" stroke="${INK}" stroke-width="1.2"/><ellipse cx="${x}" cy="${y - 10}" rx="5.5" ry="7" fill="#e2483d" ${S(1.3)}/><path d="M${x - 5} ${y - 13} H${x + 5} M${x - 5} ${y - 7} H${x + 5}" stroke="#a81f2f" stroke-width="1"/><rect x="${x - 3}" y="${y - 18}" width="6" height="2" fill="${INK}"/><rect x="${x - 3}" y="${y - 3}" width="6" height="2" fill="${INK}"/>`,
    fireworks: (x, y) => Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5; return `<path d="M${x} ${y - 12} l${(Math.cos(a) * 8).toFixed(1)} ${(Math.sin(a) * 8).toFixed(1)}" stroke="${['#e2483d', '#ffd257', '#7cc8f8'][i % 3]}" stroke-width="1.8" stroke-linecap="round"/>`; }).join(''),
    snow: (x, y) => `<g stroke="#7cc8f8" stroke-width="1.8" stroke-linecap="round"><path d="M${x} ${y - 18} V${y - 4} M${x - 6} ${y - 14.5} L${x + 6} ${y - 7.5} M${x - 6} ${y - 7.5} L${x + 6} ${y - 14.5}"/></g>`,
    mountain: (x, y) => `<path d="M${x - 11} ${y} L${x} ${y - 16} L${x + 11} ${y} Z" fill="#8fbf7a" ${S(1.4)}/><path d="M${x - 3.5} ${y - 11} L${x} ${y - 16} L${x + 3.5} ${y - 11} Q${x} ${y - 9} ${x - 3.5} ${y - 11} Z" fill="#fff" ${S(1)}/>`,
    fuji: (x, y) => `<path d="M${x - 13} ${y} L${x - 4} ${y - 15} H${x + 4} L${x + 13} ${y} Z" fill="#6f8fc9" ${S(1.4)}/><path d="M${x - 4} ${y - 15} H${x + 4} L${x + 7} ${y - 10} L${x + 3} ${y - 11} L${x} ${y - 9} L${x - 3} ${y - 11} L${x - 7} ${y - 10} Z" fill="#fff" ${S(1)}/>`,
    volcano: (x, y) => `<path d="M${x - 12} ${y} L${x - 4} ${y - 14} H${x + 4} L${x + 12} ${y} Z" fill="#a8876a" ${S(1.4)}/><g class="ic steam"><path d="M${x - 1} ${y - 16} q-3 -3 0 -6 q3 -3 0 -6" stroke="#b9c3d0" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>`,
    waterfall: (x, y) => `<path d="M${x - 9} ${y} V${y - 18} H${x - 4} V${y} M${x + 4} ${y} V${y - 18} H${x + 9} V${y}" fill="#b9a68a" ${S(1.2)}/><rect x="${x - 4}" y="${y - 18}" width="8" height="18" fill="#bfe6ff"/><path d="M${x - 2} ${y - 16} v12 M${x + 1.5} ${y - 14} v12" stroke="#fff" stroke-width="1.2"/>`,
    lighthouse: (x, y) => `<path d="M${x - 4} ${y} L${x - 3} ${y - 16} H${x + 3} L${x + 4} ${y} Z" fill="#fff" ${S(1.3)}/><path d="M${x - 3.6} ${y - 6} H${x + 3.6} M${x - 3.3} ${y - 11} H${x + 3.3}" stroke="#e2483d" stroke-width="2.2"/><rect x="${x - 3}" y="${y - 20}" width="6" height="4" fill="#ffd257" ${S(1.2)}/><path d="M${x - 4} ${y - 20} L${x} ${y - 23} L${x + 4} ${y - 20} Z" fill="#e2483d" ${S(1)}/>`,
    bridge: (x, y, c = '#e2483d') => `<path d="M${x - 12} ${y - 4} Q${x} ${y - 14} ${x + 12} ${y - 4}" stroke="${c}" stroke-width="3" fill="none"/><path d="M${x - 12} ${y - 4} Q${x} ${y - 14} ${x + 12} ${y - 4}" stroke="${INK}" stroke-width=".8" fill="none"/><path d="M${x - 8} ${y - 7} V${y - 11} M${x} ${y - 9} V${y - 13} M${x + 8} ${y - 7} V${y - 11}" stroke="${c}" stroke-width="1.6"/><path d="M${x - 14} ${y} q3 -2 6 0 t6 0 t6 0 t6 0" stroke="#7cc8f8" stroke-width="1.8" fill="none"/>`,
    windmill: (x, y) => `<path d="M${x - 3} ${y} L${x - 2} ${y - 12} H${x + 2} L${x + 3} ${y} Z" fill="#fff" ${S(1.2)}/><g class="ic spin"><path d="M${x} ${y - 13} l-8 -3 M${x} ${y - 13} l8 3 M${x} ${y - 13} l3 -8 M${x} ${y - 13} l-3 8" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/></g>`,
    gear: (x, y) => `<circle cx="${x}" cy="${y - 8}" r="6" fill="#9aa3ad" ${S(1.4)}/><circle cx="${x}" cy="${y - 8}" r="2" fill="#fff" ${S(1)}/>` + [0, 60, 120, 180, 240, 300].map((a) => `<rect x="${x - 1.5}" y="${y - 16}" width="3" height="3" fill="#9aa3ad" ${S(.8)} transform="rotate(${a} ${x} ${y - 8})"/>`).join(''),
    silk: (x, y) => `<ellipse cx="${x}" cy="${y - 7}" rx="7" ry="5" fill="#fff" ${S(1.3)}/><path d="M${x - 5} ${y - 9} q5 3 10 0 M${x - 5} ${y - 5} q5 3 10 0" stroke="#d6cfc0" stroke-width="1" fill="none"/>`,
    kimono: (x, y) => `<path d="M${x - 9} ${y - 16} L${x - 3} ${y - 18} L${x} ${y - 14} L${x + 3} ${y - 18} L${x + 9} ${y - 16} L${x + 9} ${y - 10} H${x + 5} V${y} H${x - 5} V${y - 10} H${x - 9} Z" fill="#9b6bb5" ${S(1.3)}/><rect x="${x - 5}" y="${y - 9}" width="10" height="3" fill="#f2c35a"/>`,
    music: (x, y) => `<path d="M${x - 4} ${y - 4} V${y - 16} L${x + 6} ${y - 18} V${y - 6}" stroke="${INK}" stroke-width="1.8" fill="none"/><ellipse cx="${x - 6}" cy="${y - 4}" rx="2.8" ry="2.2" fill="${INK}"/><ellipse cx="${x + 4}" cy="${y - 6}" rx="2.8" ry="2.2" fill="${INK}"/>`,
    book: (x, y) => `<path d="M${x} ${y - 12} Q${x - 5} ${y - 15} ${x - 9} ${y - 13} V${y - 3} Q${x - 5} ${y - 5} ${x} ${y - 2} Q${x + 5} ${y - 5} ${x + 9} ${y - 3} V${y - 13} Q${x + 5} ${y - 15} ${x} ${y - 12} Z" fill="#fff" ${S(1.3)}/><path d="M${x} ${y - 12} V${y - 2}" stroke="${INK}" stroke-width="1"/>`,
    pen: (x, y) => `<path d="M${x - 6} ${y} L${x + 7} ${y - 15} L${x + 9} ${y - 13} L${x - 4} ${y + 1} Z" fill="#f2c35a" ${S(1.2)}/><path d="M${x - 6} ${y} l-1 2 3 -1" fill="${INK}"/>`,
    coal: (x, y) => `<path d="M${x - 10} ${y} L${x - 8} ${y - 6} H${x + 8} L${x + 10} ${y} Z" fill="#a8743f" ${S(1.2)}/><path d="M${x - 7} ${y - 6} q3 -6 7 -4 q4 -4 7 4" fill="#3d3d44" ${S(1.1)}/>`,
    ship: (x, y) => `<path d="M${x - 11} ${y - 6} H${x + 11} L${x + 8} ${y} H${x - 8} Z" fill="#a8743f" ${S(1.3)}/><path d="M${x} ${y - 6} V${y - 20}" stroke="${INK}" stroke-width="1.6"/><path d="M${x + 1} ${y - 19} Q${x + 9} ${y - 13} ${x + 1} ${y - 8} Z" fill="#fff" ${S(1.1)}/>`,
    plane: (x, y) => `<path d="M${x - 11} ${y - 9} H${x + 9} Q${x + 12} ${y - 9} ${x + 12} ${y - 7} H${x - 9} Z M${x - 1} ${y - 9} L${x - 6} ${y - 16} H${x - 3} L${x + 4} ${y - 9} M${x - 1} ${y - 7} L${x - 5} ${y - 2} H${x - 2} L${x + 3} ${y - 7} M${x - 11} ${y - 9} L${x - 12} ${y - 13} H${x - 9} L${x - 7} ${y - 9}" fill="#fff" ${S(1.2)}/>`,
    onsenmark: (x, y) => `<ellipse cx="${x}" cy="${y - 4}" rx="7" ry="3.6" fill="none" stroke="#e2483d" stroke-width="2"/><path d="M${x - 3.5} ${y - 8} q-2 -3 0 -6 q2 -3 0 -6 M${x} ${y - 8} q-2 -3 0 -6 q2 -3 0 -6 M${x + 3.5} ${y - 8} q-2 -3 0 -6 q2 -3 0 -6" stroke="#e2483d" stroke-width="1.6" fill="none"/>`,
    sign: (x, y, t = '') => `<path d="M${x} ${y} V${y - 6}" stroke="${INK}" stroke-width="1.6"/><rect x="${x - 9}" y="${y - 16}" width="18" height="10" rx="1.5" fill="#fff" ${S(1.2)}/><text x="${x}" y="${y - 8.5}" text-anchor="middle" font-size="6.5" font-weight="900" fill="${INK}">${t}</text>`,
    butterfly: (x, y) => `<path d="M${x} ${y - 8} Q${x - 9} ${y - 16} ${x - 8} ${y - 8} Q${x - 8} ${y - 3} ${x} ${y - 8} Q${x + 8} ${y - 3} ${x + 8} ${y - 8} Q${x + 9} ${y - 16} ${x} ${y - 8} Z" fill="#ffd257" ${S(1.2)}/><path d="M${x} ${y - 12} V${y - 4}" stroke="${INK}" stroke-width="1.6"/>`,
    leaf: (x, y) => `<path d="M${x - 6} ${y} Q${x - 8} ${y - 14} ${x + 6} ${y - 16} Q${x + 7} ${y - 3} ${x - 6} ${y} Z" fill="#7aa83e" ${S(1.3)}/><path d="M${x - 6} ${y} L${x + 4} ${y - 13}" stroke="#4d7a2a" stroke-width="1"/>`,
    swan: (x, y) => `<path d="M${x - 8} ${y - 6} Q${x - 6} ${y} ${x + 4} ${y} Q${x + 8} ${y - 4} ${x + 3} ${y - 7} Q${x + 1} ${y - 9} ${x + 2} ${y - 14} Q${x + 3} ${y - 18} ${x + 7} ${y - 16}" fill="#fff" ${S(1.3)}/><path d="M${x + 7} ${y - 16} l3 1" stroke="#f7b733" stroke-width="2"/><path d="M${x - 12} ${y + 1} q4 -2 8 0 t8 0 t8 0" stroke="#7cc8f8" stroke-width="1.6" fill="none"/>`,
    kakashi: (x, y) => `<path d="M${x} ${y} V${y - 14} M${x - 8} ${y - 10} H${x + 8}" stroke="#a8743f" stroke-width="2"/><circle cx="${x}" cy="${y - 15}" r="3.6" fill="#fff" ${S(1.2)}/><path d="M${x - 7} ${y - 17} Q${x} ${y - 24} ${x + 7} ${y - 17} Z" fill="#f2c35a" ${S(1.2)}/><path d="M${x - 4} ${y - 11} H${x + 4} L${x + 3} ${y - 4} H${x - 3} Z" fill="#7cc8f8" ${S(1.1)}/>`,
    coin: (x, y) => `<circle cx="${x}" cy="${y - 8}" r="7" fill="#f2c35a" ${S(1.4)}/><circle cx="${x}" cy="${y - 8}" r="4.6" fill="none" stroke="#c9963e" stroke-width="1"/><text x="${x}" y="${y - 5.5}" text-anchor="middle" font-size="7" font-weight="900" fill="${INK}">円</text>`,
    watermelon: (x, y) => `<path d="M${x - 9} ${y - 8} A9 9 0 0 0 ${x + 9} ${y - 8} Z" fill="#e2483d" ${S(1.4)}/><path d="M${x - 9} ${y - 8} A9 9 0 0 0 ${x + 9} ${y - 8}" fill="none" stroke="#3f8f4f" stroke-width="2.4"/><circle cx="${x - 3}" cy="${y - 5}" r=".8" fill="${INK}"/><circle cx="${x + 2}" cy="${y - 4}" r=".8" fill="${INK}"/><circle cx="${x + 4}" cy="${y - 6.5}" r=".8" fill="${INK}"/>`,
    dango: (x, y) => `<path d="M${x - 6} ${y} L${x + 6} ${y - 20}" stroke="#a8743f" stroke-width="1.4"/>` + [['#ff9eb0', 0], ['#fff', 1], ['#7aa83e', 2]].map(([c, i]) => `<circle cx="${x - 3 + i * 3.6}" cy="${y - 6 - i * 5.6}" r="3.6" fill="${c}" ${S(1.2)}/>`).join(''),
    lotus: (x, y) => `<path d="M${x} ${y - 2} Q${x - 9} ${y - 6} ${x - 5} ${y - 14} Q${x} ${y - 9} ${x} ${y - 2} Q${x} ${y - 9} ${x + 5} ${y - 14} Q${x + 9} ${y - 6} ${x} ${y - 2} Z M${x} ${y - 2} Q${x - 3} ${y - 10} ${x} ${y - 17} Q${x + 3} ${y - 10} ${x} ${y - 2} Z" fill="#ffc3d6" ${S(1.1)}/>`,
    rabbit: (x, y) => `<ellipse cx="${x}" cy="${y - 5}" rx="6" ry="5" fill="#fff" ${S(1.3)}/><ellipse cx="${x - 2.5}" cy="${y - 14}" rx="1.8" ry="5" fill="#fff" ${S(1.1)}/><ellipse cx="${x + 2.5}" cy="${y - 14}" rx="1.8" ry="5" fill="#fff" ${S(1.1)}/><circle cx="${x - 2}" cy="${y - 6}" r=".9" fill="${INK}"/><circle cx="${x + 2}" cy="${y - 6}" r=".9" fill="${INK}"/><circle cx="${x}" cy="${y - 4}" r=".8" fill="${CHEEK}"/>`,
    crown: (x, y) => `<path d="M${x - 8} ${y - 3} L${x - 9} ${y - 14} L${x - 4} ${y - 9} L${x} ${y - 16} L${x + 4} ${y - 9} L${x + 9} ${y - 14} L${x + 8} ${y - 3} Z" fill="#f2c35a" ${S(1.3)}/><circle cx="${x}" cy="${y - 7}" r="1.6" fill="#e2483d"/>`,
    hina: (x, y) => `<path d="M${x - 7} ${y} L${x - 5} ${y - 10} H${x + 5} L${x + 7} ${y} Z" fill="#e2483d" ${S(1.2)}/><path d="M${x - 5} ${y - 10} L${x} ${y - 4} L${x + 5} ${y - 10}" stroke="#f2c35a" stroke-width="1.4" fill="none"/><circle cx="${x}" cy="${y - 13}" r="3.6" fill="#fff" ${S(1.1)}/><path d="M${x - 3.6} ${y - 14} Q${x} ${y - 19} ${x + 3.6} ${y - 14} Z" fill="${INK}"/>`,
    pear: (x, y) => `<circle cx="${x}" cy="${y - 6}" r="6" fill="#d9c25a" ${S(1.4)}/><circle cx="${x - 2}" cy="${y - 8}" r=".6" fill="#a8874c"/><circle cx="${x + 2}" cy="${y - 5}" r=".6" fill="#a8874c"/><path d="M${x} ${y - 12} v-3" stroke="${INK}" stroke-width="1.4"/>`,
    surf: (x, y) => `<ellipse cx="${x}" cy="${y - 10}" rx="3.4" ry="10" fill="#ff9a1f" ${S(1.3)} transform="rotate(20 ${x} ${y - 10})"/><path d="M${x - 1} ${y - 18} l3 16" stroke="#fff" stroke-width="1.2" transform="rotate(20 ${x} ${y - 10})"/>`,
    gem: (x, y) => `<path d="M${x - 7} ${y - 10} L${x - 3} ${y - 15} H${x + 3} L${x + 7} ${y - 10} L${x} ${y - 1} Z" fill="#5fcf9f" ${S(1.3)}/><path d="M${x - 7} ${y - 10} H${x + 7} M${x - 3} ${y - 15} L${x - 2} ${y - 10} L${x} ${y - 1} M${x + 3} ${y - 15} L${x + 2} ${y - 10}" stroke="${INK}" stroke-width=".8" fill="none"/>`,
    train: (x, y, c = '#e2483d') => `<rect x="${x - 10}" y="${y - 12}" width="20" height="10" rx="3" fill="${c}" ${S(1.3)}/><rect x="${x - 7}" y="${y - 10}" width="4" height="4" fill="#bfe6ff" ${S(.8)}/><rect x="${x - 1}" y="${y - 10}" width="4" height="4" fill="#bfe6ff" ${S(.8)}/><circle cx="${x - 6}" cy="${y - 1}" r="2" fill="#5c6878" ${S(1)}/><circle cx="${x + 6}" cy="${y - 1}" r="2" fill="#5c6878" ${S(1)}/>`,
    kasa: (x, y) => `<path d="M${x - 11} ${y - 4} Q${x} ${y - 20} ${x + 11} ${y - 4} Q${x} ${y - 7} ${x - 11} ${y - 4} Z" fill="#e8c97a" ${S(1.3)}/><path d="M${x - 6} ${y - 7} Q${x} ${y - 16} ${x + 6} ${y - 7}" stroke="#c9a23e" stroke-width="1" fill="none"/><path d="M${x - 4} ${y - 5} q4 6 8 0" stroke="#e2483d" stroke-width="1.4" fill="none"/>`,
    glass: (x, y) => `<path d="M${x - 3} ${y - 18} H${x + 3} L${x + 2} ${y - 14} Q${x + 8} ${y - 10} ${x + 5} ${y} H${x - 5} Q${x - 8} ${y - 10} ${x - 2} ${y - 14} Z" fill="#7cd3e8" fill-opacity=".85" ${S(1.3)}/><path d="M${x - 3} ${y - 10} q1 4 0 7" stroke="#fff" stroke-width="1.4" fill="none"/>`,
    birch: (x, y) => `<rect x="${x - 1.8}" y="${y - 16}" width="3.6" height="16" fill="#fff" ${S(1.1)}/><path d="M${x - 1.8} ${y - 12} h2 M${x} ${y - 7} h1.8" stroke="${INK}" stroke-width="1"/><circle cx="${x}" cy="${y - 18}" r="6" fill="#a5dc8f" ${S(1.2)}/>`,
    tower: (x, y) => `<path d="M${x - 5} ${y} L${x - 2} ${y - 18} H${x + 2} L${x + 5} ${y} Z" fill="#e8eef4" ${S(1.3)}/><rect x="${x - 4}" y="${y - 22}" width="8" height="5" rx="1.5" fill="#7cc8f8" ${S(1.2)}/><path d="M${x} ${y - 22} V${y - 26}" stroke="${INK}" stroke-width="1.2"/>`,
    zipper: (x, y) => `<rect x="${x - 4}" y="${y - 18}" width="8" height="18" fill="#7cc8f8" ${S(1.2)}/>` + [0, 1, 2, 3, 4].map((i) => `<path d="M${x - 2} ${y - 16 + i * 3.4} h4" stroke="#f2c35a" stroke-width="1.6"/>`).join('') + `<rect x="${x - 2.5}" y="${y - 7}" width="5" height="5" rx="1" fill="#f2c35a" ${S(1)}/>`,
    whisky: (x, y) => `<rect x="${x - 4}" y="${y - 14}" width="8" height="14" rx="1.5" fill="#c9714a" ${S(1.3)}/><rect x="${x - 1.6}" y="${y - 19}" width="3.2" height="5" fill="#c9714a" ${S(1.1)}/><rect x="${x - 3}" y="${y - 10}" width="6" height="5" fill="#f2e3c6" ${S(.7)}/>`,
    sun: (x, y) => `<circle cx="${x}" cy="${y - 10}" r="5.5" fill="#ff9a1f" ${S(1.3)}/>` + Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<path d="M${(x + Math.cos(a) * 7.5).toFixed(1)} ${(y - 10 + Math.sin(a) * 7.5).toFixed(1)} L${(x + Math.cos(a) * 10).toFixed(1)} ${(y - 10 + Math.sin(a) * 10).toFixed(1)}" stroke="#ff9a1f" stroke-width="1.8" stroke-linecap="round"/>`; }).join(''),
    mushroom: (x, y) => `<rect x="${x - 2}" y="${y - 9}" width="4" height="9" rx="1.5" fill="#f2e3c6" ${S(1.2)}/><path d="M${x - 8} ${y - 8} Q${x - 8} ${y - 16} ${x} ${y - 16} Q${x + 8} ${y - 16} ${x + 8} ${y - 8} Z" fill="#a8743f" ${S(1.3)}/>`,
    moon: (x, y) => `<path d="M${x + 2} ${y - 20} A9 9 0 1 0 ${x + 6} ${y - 4} A7 7 0 1 1 ${x + 2} ${y - 20} Z" fill="#ffd257" ${S(1.2)}/>`,
    lettuce: (x, y) => `<circle cx="${x}" cy="${y - 7}" r="7" fill="#a5dc8f" ${S(1.4)}/><path d="M${x - 5} ${y - 9} q5 -4 10 0 M${x - 6} ${y - 5} q6 -3 12 0" stroke="#5fbf6f" stroke-width="1.2" fill="none"/>`,
    comb: (x, y) => `<path d="M${x - 9} ${y - 10} Q${x} ${y - 18} ${x + 9} ${y - 10} Z" fill="#c98b4f" ${S(1.3)}/>` + [-6, -3, 0, 3, 6].map((d) => `<path d="M${x + d} ${y - 10} V${y - 3}" stroke="#c98b4f" stroke-width="2"/>`).join(''),
    bun: (x, y) => `<ellipse cx="${x}" cy="${y - 6}" rx="8" ry="6" fill="#f2e3c6" ${S(1.4)}/><path d="M${x - 4} ${y - 8} q4 -2 8 0" stroke="#c9a86a" stroke-width="1.2" fill="none"/><circle cx="${x + 2}" cy="${y - 4}" r="1" fill="#a8743f"/>`,
    bread: (x, y) => `<path d="M${x - 9} ${y} V${y - 8} Q${x - 9} ${y - 14} ${x} ${y - 14} Q${x + 9} ${y - 14} ${x + 9} ${y - 8} V${y} Z" fill="#e8a85a" ${S(1.4)}/><path d="M${x - 4} ${y - 10} l2 3 M${x + 1} ${y - 11} l2 3" stroke="#c9714a" stroke-width="1.4"/>`,
    jizo: (x, y) => `<rect x="${x - 7}" y="${y - 3}" width="14" height="3" fill="#b9b2a6" ${S(1.1)}/><path d="M${x - 5} ${y - 3} Q${x - 6} ${y - 11} ${x} ${y - 12} Q${x + 6} ${y - 11} ${x + 5} ${y - 3} Z" fill="#b9b2a6" ${S(1.2)}/><circle cx="${x}" cy="${y - 15}" r="4" fill="#b9b2a6" ${S(1.2)}/><path d="M${x - 5} ${y - 11} H${x + 5} L${x} ${y - 7} Z" fill="#e2483d" ${S(1)}/>`,
    tomato: (x, y) => `<circle cx="${x}" cy="${y - 6}" r="6" fill="#e2483d" ${S(1.4)}/><path d="M${x - 4} ${y - 12} l4 2 4 -2 -2 3 h-4 z" fill="#5fbf6f" ${S(.8)}/>`,
    chestnut: (x, y) => `<path d="M${x} ${y - 15} Q${x + 8} ${y - 8} ${x + 6} ${y - 2} Q${x} ${y + 1} ${x - 6} ${y - 2} Q${x - 8} ${y - 8} ${x} ${y - 15} Z" fill="#8a5a33" ${S(1.4)}/><path d="M${x - 6} ${y - 4} Q${x} ${y - 1} ${x + 6} ${y - 4}" stroke="#d9b98a" stroke-width="2" fill="none"/>`,
    waterwheel: (x, y) => `<circle cx="${x}" cy="${y - 9}" r="8" fill="none" stroke="#a8743f" stroke-width="2.4"/><circle cx="${x}" cy="${y - 9}" r="8" fill="none" ${S(.8)}/><g class="ic spin">` + [0, 45, 90, 135].map((a) => `<path d="M${x} ${y - 17} V${y - 1}" stroke="#a8743f" stroke-width="1.6" transform="rotate(${a} ${x} ${y - 9})"/>`).join('') + `</g>`,
    shrimp: (x, y) => `<path d="M${x + 7} ${y - 12} Q${x - 2} ${y - 16} ${x - 6} ${y - 8} Q${x - 7} ${y - 2} ${x - 1} ${y - 2} L${x - 3} ${y + 1} M${x - 1} ${y - 2} L${x + 1} ${y + 1}" fill="#ff8f8f" ${S(1.3)}/><path d="M${x + 6} ${y - 12} q4 -4 6 -3 M${x + 6} ${y - 11} q4 -1 6 1" stroke="${INK}" stroke-width=".9" fill="none"/>`,
    cactus: (x, y) => `<rect x="${x - 2.5}" y="${y - 18}" width="5" height="18" rx="2.5" fill="#5fbf6f" ${S(1.2)}/><path d="M${x - 2.5} ${y - 10} H${x - 6} V${y - 14} M${x + 2.5} ${y - 7} H${x + 6} V${y - 12}" stroke="#5fbf6f" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="${x}" cy="${y - 19}" r="2" fill="#ff9eb0"/>`,
    persimmon: (x, y) => `<ellipse cx="${x}" cy="${y - 6}" rx="7" ry="6" fill="#ff8a1f" ${S(1.4)}/><path d="M${x - 4} ${y - 11} h8 l-2 2 h-4 z" fill="#5fbf6f" ${S(.9)}/><path d="M${x} ${y - 11} v-3" stroke="${INK}" stroke-width="1.4"/>`,
    eel: (x, y) => `<path d="M${x - 10} ${y - 4} Q${x - 5} ${y - 12} ${x} ${y - 6} Q${x + 5} ${y} ${x + 10} ${y - 8}" stroke="#4a5a3a" stroke-width="3.6" fill="none" stroke-linecap="round"/><circle cx="${x + 9}" cy="${y - 8.5}" r=".8" fill="#fff"/>`,
    bird: (x, y, c = '#a8743f') => `<ellipse cx="${x}" cy="${y - 6}" rx="6" ry="4.4" fill="${c}" ${S(1.3)}/><circle cx="${x + 5}" cy="${y - 10}" r="3.2" fill="${c}" ${S(1.2)}/><path d="M${x + 8} ${y - 10} l3 1 -3 1" fill="#f7b733"/><circle cx="${x + 5.5}" cy="${y - 10.5}" r=".7" fill="${INK}"/><path d="M${x - 6} ${y - 7} l-4 -2" stroke="${INK}" stroke-width="1.6"/>`,
    car: (x, y) => `<path d="M${x - 11} ${y - 3} V${y - 7} Q${x - 10} ${y - 9} ${x - 6} ${y - 9} L${x - 3} ${y - 13} H${x + 4} L${x + 7} ${y - 9} Q${x + 11} ${y - 9} ${x + 11} ${y - 6} V${y - 3} Z" fill="#e2483d" ${S(1.3)}/><path d="M${x - 2} ${y - 12} H${x + 3} L${x + 5} ${y - 9} H${x - 4} Z" fill="#bfe6ff" ${S(.8)}/><circle cx="${x - 6}" cy="${y - 2}" r="2.6" fill="#5c6878" ${S(1.1)}/><circle cx="${x + 6}" cy="${y - 2}" r="2.6" fill="#5c6878" ${S(1.1)}/>`,
    heli: (x, y) => `<ellipse cx="${x}" cy="${y - 8}" rx="7" ry="5" fill="#6f8f4f" ${S(1.3)}/><path d="M${x + 6} ${y - 9} H${x + 14} l2 -3" stroke="#6f8f4f" stroke-width="2.4" fill="none"/><g class="ic spin"><path d="M${x - 11} ${y - 15} H${x + 11}" stroke="${INK}" stroke-width="1.8"/></g><path d="M${x} ${y - 13} V${y - 15} M${x - 5} ${y - 3} V${y} M${x + 5} ${y - 3} V${y} M${x - 8} ${y} H${x + 8}" stroke="${INK}" stroke-width="1.4"/><circle cx="${x - 3}" cy="${y - 9}" r="2" fill="#bfe6ff"/>`,
    shuriken: (x, y) => `<path d="M${x} ${y - 18} L${x + 2.5} ${y - 11} L${x + 9} ${y - 9} L${x + 2.5} ${y - 7} L${x} ${y} L${x - 2.5} ${y - 7} L${x - 9} ${y - 9} L${x - 2.5} ${y - 11} Z" fill="#9aa3ad" ${S(1.3)}/><circle cx="${x}" cy="${y - 9}" r="1.6" fill="#fff" ${S(.8)}/>`,
    heart: (x, y) => `<path d="M${x} ${y - 2} Q${x - 10} ${y - 9} ${x - 6} ${y - 14} Q${x - 2} ${y - 17} ${x} ${y - 12} Q${x + 2} ${y - 17} ${x + 6} ${y - 14} Q${x + 10} ${y - 9} ${x} ${y - 2} Z" fill="#ff7aa0" ${S(1.3)}/>`,
    turtle: (x, y) => `<ellipse cx="${x}" cy="${y - 6}" rx="8" ry="5.5" fill="#5f9f6f" ${S(1.4)}/><path d="M${x - 4} ${y - 9} l4 3 4 -3 M${x - 4} ${y - 3} l4 -3 4 3" stroke="#3f7f4f" stroke-width="1" fill="none"/><circle cx="${x + 10}" cy="${y - 7}" r="2.6" fill="#a5dc8f" ${S(1.1)}/><path d="M${x - 7} ${y - 2} l-3 2 M${x + 6} ${y - 2} l3 2" stroke="#a5dc8f" stroke-width="2.4" stroke-linecap="round"/>`,
    reed: (x, y) => [-4, 0, 4].map((d, i) => `<path d="M${x + d} ${y} Q${x + d + 1} ${y - 10} ${x + d + 2} ${y - 18 + i * 2}" stroke="#a8a85a" stroke-width="1.4" fill="none"/><ellipse cx="${x + d + 2}" cy="${y - 19 + i * 2}" rx="1.4" ry="3" fill="#c9a86a"/>`).join(''),
    dotaku: (x, y) => `<path d="M${x - 5} ${y - 16} H${x + 5} L${x + 7} ${y - 1} H${x - 7} Z" fill="#5fa898" ${S(1.3)}/><path d="M${x - 5} ${y - 16} Q${x} ${y - 21} ${x + 5} ${y - 16}" stroke="#5fa898" stroke-width="2" fill="none"/><path d="M${x - 5} ${y - 11} H${x + 5} M${x - 6} ${y - 6} H${x + 6}" stroke="#3f7f6f" stroke-width="1"/>`,
    onion: (x, y) => `<path d="M${x} ${y - 16} Q${x + 1} ${y - 12} ${x + 6} ${y - 8} Q${x + 7} ${y - 1} ${x} ${y} Q${x - 7} ${y - 1} ${x - 6} ${y - 8} Q${x - 1} ${y - 12} ${x} ${y - 16} Z" fill="#e8b46a" ${S(1.3)}/><path d="M${x} ${y - 13} Q${x - 3} ${y - 6} ${x} ${y - 1}" stroke="#c98b4f" stroke-width="1" fill="none"/>`,
    kappa: (x, y) => `<circle cx="${x}" cy="${y - 9}" r="6.5" fill="#7ac36a" ${S(1.4)}/><ellipse cx="${x}" cy="${y - 15}" rx="4" ry="1.6" fill="#fff" ${S(1)}/><path d="M${x - 2} ${y - 7} L${x} ${y - 5} L${x + 2} ${y - 7} Z" fill="#f7b733" ${S(.8)}/><circle cx="${x - 2.5}" cy="${y - 10}" r=".9" fill="${INK}"/><circle cx="${x + 2.5}" cy="${y - 10}" r=".9" fill="${INK}"/><rect x="${x - 4}" y="${y - 3}" width="8" height="3" rx="1.5" fill="#7ac36a" ${S(1)}/>`,
    crow: (x, y) => `<ellipse cx="${x}" cy="${y - 6}" rx="6" ry="4.6" fill="#2a2a33" ${S(1.2)}/><circle cx="${x + 5}" cy="${y - 10}" r="3.2" fill="#2a2a33" ${S(1.1)}/><path d="M${x + 8} ${y - 10} l3 1 -3 1" fill="#555"/><circle cx="${x + 5.5}" cy="${y - 10.5}" r=".8" fill="#ffd257"/><path d="M${x - 3} ${y - 1} V${y + 1} M${x} ${y - 1} V${y + 1} M${x + 3} ${y - 1} V${y + 1}" stroke="${INK}" stroke-width="1.2"/>`,
    olive: (x, y) => `<path d="M${x - 8} ${y - 14} Q${x} ${y - 10} ${x + 8} ${y - 16}" stroke="#7a8a4a" stroke-width="1.4" fill="none"/><ellipse cx="${x - 4}" cy="${y - 15}" rx="3.6" ry="1.4" fill="#8aa05a" transform="rotate(-20 ${x - 4} ${y - 15})"/><ellipse cx="${x + 4}" cy="${y - 16}" rx="3.6" ry="1.4" fill="#8aa05a" transform="rotate(20 ${x + 4} ${y - 16})"/><ellipse cx="${x - 2}" cy="${y - 7}" rx="2.6" ry="3.4" fill="#4a5a2a" ${S(1)}/><ellipse cx="${x + 3}" cy="${y - 6}" rx="2.6" ry="3.4" fill="#7a8a3a" ${S(1)}/>`,
    firefly: (x, y) => [[0, -14], [-7, -6], [7, -8]].map(([dx, dy], i) => `<g class="ic float" style="animation-delay:${i * .4}s"><circle cx="${x + dx}" cy="${y + dy}" r="4" fill="#f4ff8a" opacity=".55"/><circle cx="${x + dx}" cy="${y + dy}" r="1.8" fill="#e8ff3a" ${S(.6)}/></g>`).join(''),
    yuzu: (x, y) => `<circle cx="${x}" cy="${y - 6}" r="6" fill="#ffd257" ${S(1.5)}/><circle cx="${x - 2}" cy="${y - 7}" r=".6" fill="#c9a23e"/><circle cx="${x + 2}" cy="${y - 4}" r=".6" fill="#c9a23e"/><path d="M${x} ${y - 12} q3 -2 5 0 q-3 2 -5 0" fill="#5fbf6f" ${S(1)}/>`,
    whirl: (x, y) => `<path d="M${x} ${y - 8} m-1 0 a1 1 0 1 1 2 0 a3 3 0 1 1 -5 -1 a5 5 0 1 1 9 2 a7 7 0 1 1 -13 -3" stroke="#2c6fc0" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    salt: (x, y) => `<path d="M${x - 9} ${y} Q${x} ${y - 16} ${x + 9} ${y} Z" fill="#fff" ${S(1.3)}/><path d="M${x - 3} ${y - 6} l1 -1 M${x + 2} ${y - 8} l1 -1" stroke="#b9c3d0" stroke-width="1"/>`,
    pin: (x, y) => `<path d="M${x} ${y - 19} Q${x + 3} ${y - 19} ${x + 3} ${y - 15} Q${x + 2} ${y - 12} ${x + 2} ${y - 11} Q${x + 6} ${y - 6} ${x + 3} ${y} H${x - 3} Q${x - 6} ${y - 6} ${x - 2} ${y - 11} Q${x - 2} ${y - 12} ${x - 3} ${y - 15} Q${x - 3} ${y - 19} ${x} ${y - 19} Z" fill="#fff" ${S(1.3)}/><path d="M${x - 2.2} ${y - 13} H${x + 2.2}" stroke="#e2483d" stroke-width="1.6"/>`,
    chair: (x, y) => `<path d="M${x - 6} ${y} V${y - 20} H${x + 4} V${y - 9} H${x + 8} V${y} M${x - 6} ${y - 9} H${x + 8}" stroke="#a8743f" stroke-width="3" fill="none" stroke-linejoin="round"/>`,
    stork: (x, y) => `<path d="M${x - 9} ${y - 8} Q${x} ${y - 14} ${x + 6} ${y - 8} Q${x} ${y - 4} ${x - 9} ${y - 8} Z" fill="#fff" ${S(1.3)}/><path d="M${x - 9} ${y - 8} Q${x - 4} ${y - 6} ${x - 1} ${y - 9}" fill="${INK}"/><path d="M${x + 4} ${y - 9} Q${x + 8} ${y - 16} ${x + 6} ${y - 19}" stroke="${INK}" stroke-width="1.6" fill="none"/><path d="M${x + 6} ${y - 19} l4 2" stroke="#e2483d" stroke-width="1.6"/><path d="M${x - 2} ${y - 5} V${y} M${x + 1} ${y - 5} V${y}" stroke="#e2483d" stroke-width="1.2"/>`,
    bigtree: (x, y) => `<rect x="${x - 2.4}" y="${y - 10}" width="4.8" height="10" fill="#8a5a33" ${S(1.2)}/><circle cx="${x}" cy="${y - 15}" r="8" fill="#3f8f4f" ${S(1.4)}/><circle cx="${x - 5}" cy="${y - 11}" r="4.6" fill="#3f8f4f" ${S(1.2)}/><circle cx="${x + 5}" cy="${y - 11}" r="4.6" fill="#3f8f4f" ${S(1.2)}/>`,
    heron: (x, y) => `<path d="M${x - 9} ${y - 8} Q${x} ${y - 14} ${x + 6} ${y - 8} Q${x} ${y - 4} ${x - 9} ${y - 8} Z" fill="#fff" ${S(1.3)}/><path d="M${x + 4} ${y - 9} Q${x + 8} ${y - 16} ${x + 6} ${y - 19}" stroke="${INK}" stroke-width="1.6" fill="none"/><path d="M${x + 6} ${y - 19} l4 1" stroke="#f7b733" stroke-width="1.6"/><path d="M${x - 2} ${y - 5} V${y} M${x + 1} ${y - 5} V${y}" stroke="${INK}" stroke-width="1.2"/>`,
    bamboo: (x, y) => [-3, 2].map((d) => `<rect x="${x + d - 1.4}" y="${y - 20}" width="2.8" height="20" fill="#7aa83e" ${S(.8)}/><path d="M${x + d - 1.4} ${y - 13} h2.8 M${x + d - 1.4} ${y - 6} h2.8" stroke="${INK}" stroke-width=".8"/>`).join('') + `<path d="M${x + 1} ${y - 16} q4 -2 7 0 M${x - 2} ${y - 10} q-4 -2 -7 0" stroke="#7aa83e" stroke-width="2" fill="none"/>`,
  };
  // 目印を置く位置（土台ごと。1 つ目・2 つ目）
  const SLOT = {
    castle: [[33, 30], [5, 57]], jinja: [[34, 57], [32, 30]], tera: [[34, 57], [5, 26]], onsen: [[48, 42], [38, 26]], museum: [[30, 57], [8, 26]],
    michi: [[13, 50], [25, 50], [32, 22]], view: [[28, 30], [10, 30]], station: [[30, 28], [8, 28]], ferry: [[30, 26], [8, 26]], zoo: [[19, 50], [8, 30]],
    library: [[32, 57], [8, 28]], park: [[31, 57], [6, 57]], sky: [[19, 34], [8, 30]], beach: [[19, 50], [8, 30]],
  };

  function svg(spec) {
    const [b, o = {}, ms = []] = spec;
    const slots = SLOT[b] || [[30, 57], [8, 30]];
    const marks = ms.map((m, i) => {
      const [k, ...arg] = Array.isArray(m) ? m : [m];
      const [x, y] = slots[i] || slots[0];
      return M[k] ? M[k](x, y, ...arg) : '';
    }).join('');
    // キャラクターは 8 割に縮めて右下に（主役は左の建物と目印）。温泉は湯船の人だけ
    const ch = b === 'onsen' ? '' : `<g transform="translate(52 58) scale(.78) translate(-50 -58)">${(CHARA[b] || CHARA.museum)()}</g>`;
    return `<g>${(BASE[b] || BASE.museum)(o)}${marks}${ch}</g>`;
  }
  return { svg, M, BASE };
})();
// スポットの絵: 専用の絵があればそれ、なければ種類ごとの絵。sp = [種類, 名前, 緯度, 経度, ...]
// data/spotart.json は { "名前|緯度|経度": [土台, {選択肢}, [目印...]] }（scripts/build_map.py が scripts/spotart_specs.json から作る）
let SPOTART = {};
const loadSpotArt = () => getJSON('data/spotart.json').then((d) => (SPOTART = d)).catch(() => SPOTART);
const spotIcon = (sp) => { const a = SPOTART[`${sp[1]}|${sp[2]}|${sp[3]}`]; return a ? SA.svg(a) : ICONS[sp[0]]; };
