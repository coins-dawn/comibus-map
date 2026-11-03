'use strict';
// 自作のイラスト（すべて SVG）。64×64、足もとが下端の中央。線はこげ茶、2 頭身、ほっぺはピンク。
// 動きは style.css の .bow .hop .wave .rock .glide .float .munch .bob .steam
const INK = '#4a3426', SKIN = '#ffd9b8', CHEEK = '#ff9eb0';
const face = (cx, cy, eyes = 'smile') => {
  const e = eyes === 'closed'
    ? `<path d="M${cx - 6.5} ${cy + 1} q2 2.4 4 0"/><path d="M${cx + 2.5} ${cy + 1} q2 2.4 4 0"/>`
    : `<path d="M${cx - 6.5} ${cy + 1.6} q2 -2.6 4 0"/><path d="M${cx + 2.5} ${cy + 1.6} q2 -2.6 4 0"/>`;
  return `<circle cx="${cx - 7}" cy="${cy + 4.6}" r="2.2" fill="${CHEEK}"/><circle cx="${cx + 7}" cy="${cy + 4.6}" r="2.2" fill="${CHEEK}"/>
    <g fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round">${e}</g>`;
};
const head = (cx, cy, hair = '#3a2a20') => `<circle cx="${cx}" cy="${cy}" r="10" fill="${SKIN}" stroke="${INK}" stroke-width="2.2"/>
  <path d="M${cx - 10} ${cy - 1} Q${cx - 9.5} ${cy - 11} ${cx} ${cy - 11} Q${cx + 10} ${cy - 11} ${cx + 10} ${cy - 1.5} Q${cx + 5} ${cy - 6} ${cx} ${cy - 5.5} Q${cx - 5} ${cy - 6} ${cx - 10} ${cy - 1} Z" fill="${hair}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
const limb = (d, fill, w = 6.5) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${w - 3.2}" stroke-linecap="round" stroke-linejoin="round"/>`;
const shoe = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="3.8" ry="2.3" fill="#e2483d" stroke="${INK}" stroke-width="1.8"/>`;
const mouth = (cx, cy) => `<path d="M${cx - 2} ${cy} q2 1.8 4 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
const body = (cx, color) => `<path d="M${cx - 11} 34 Q${cx} 29 ${cx + 11} 34 L${cx + 11.5} 47 Q${cx} 50.5 ${cx - 11.5} 47 Z" fill="${color}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
const legs = (cx, color = '#5c6878') => `${limb(`M${cx - 4} 46 L${cx - 5} 56`, color)}${limb(`M${cx + 4} 46 L${cx + 5} 56`, color)}${shoe(cx - 6, 57)}${shoe(cx + 6, 57)}`;
// おじぎする人（手を合わせる）
const prayer = (cx, color) => `<g class="ic bow">${legs(cx)}${body(cx, color)}
  ${limb(`M${cx - 6} 37 L${cx - 10} 41`, SKIN)}${limb(`M${cx + 6} 37 L${cx - 9} 41`, SKIN)}
  ${head(cx, 21)}${face(cx, 21, 'closed')}</g>`;

const ICONS = {
  jinja: `<g>
    <path d="M2 18 Q16 14 30 18 L29 21.5 Q16 18 3 21.5 Z" fill="#e2483d" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="5" y="25" width="22" height="3.4" fill="#e2483d" stroke="${INK}" stroke-width="1.8"/>
    <rect x="8" y="20" width="3.6" height="37" fill="#e2483d" stroke="${INK}" stroke-width="1.8"/>
    <rect x="20.4" y="20" width="3.6" height="37" fill="#e2483d" stroke="${INK}" stroke-width="1.8"/>
    <path d="M1 57 H31" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    ${prayer(46, '#7cc8f8')}
  </g>`,
  tera: `<g>
    <rect x="6" y="35" width="24" height="20" fill="#f2e3c6" stroke="${INK}" stroke-width="2"/>
    <rect x="13" y="42" width="10" height="13" fill="#8a5a33" stroke="${INK}" stroke-width="1.6"/>
    <path d="M1 36 Q9 32 11 23 H25 Q27 32 35 36 Z" fill="#5c6878" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M14 23 L18 17 L22 23" fill="#f7b733" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M2 56 H34" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
    ${prayer(47, '#f7b733')}
    <g class="ic steam"><path d="M58 30 q-2 -3 0 -6 q2 -3 0 -6" fill="none" stroke="#b9c3d0" stroke-width="1.8" stroke-linecap="round"/></g>
  </g>`,
  onsen: `<g>
    <g class="ic steam">
      <path d="M20 16 q-3 -4 0 -8 q3 -4 0 -8" fill="none" stroke="#e2483d" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M32 14 q-3 -4 0 -8 q3 -4 0 -8" fill="none" stroke="#e2483d" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M44 16 q-3 -4 0 -8 q3 -4 0 -8" fill="none" stroke="#e2483d" stroke-width="2.4" stroke-linecap="round"/>
    </g>
    <g class="ic bob">${head(32, 33)}${face(32, 33, 'closed')}
      <rect x="25" y="20" width="14" height="5" rx="2" fill="#fff" stroke="${INK}" stroke-width="1.6"/></g>
    <path d="M6 40 H58 L54 56 Q53 58 50 58 H14 Q11 58 10 56 Z" fill="#c98b4f" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M7 41 Q19 37 32 41 T57 41" fill="#9fdcff" stroke="${INK}" stroke-width="1.8"/>
    <path d="M10 48 H54 M12 53 H52" stroke="#e7b27c" stroke-width="1.6"/>
  </g>`,
  castle: `<g>
    <rect x="4" y="40" width="30" height="16" fill="#9aa3ad" stroke="${INK}" stroke-width="2"/>
    <path d="M4 46 H34 M4 51 H34 M12 40 V56 M22 40 V56" stroke="#7e8894" stroke-width="1"/>
    <rect x="9" y="30" width="20" height="10" fill="#fff" stroke="${INK}" stroke-width="2"/>
    <path d="M5 31 Q19 25 33 31 L30 27 H8 Z" fill="#3d4a5c" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="12" y="20" width="14" height="8" fill="#fff" stroke="${INK}" stroke-width="2"/>
    <path d="M8 21 Q19 15 30 21 L27 17 H11 Z" fill="#3d4a5c" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M12 16 q-2 -4 1 -5 M26 16 q2 -4 -1 -5" stroke="#f7b733" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <rect x="16" y="33" width="2.4" height="4" fill="${INK}"/><rect x="20" y="33" width="2.4" height="4" fill="${INK}"/>
    <g>${legs(48)}${body(48, '#e2483d')}${limb('M42 37 L38 42', SKIN)}
      <g class="ic wave">${limb('M54 37 L58 28', SKIN)}<path d="M58 30 V8" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
        <path d="M58 9 L48 12 L58 16 Z" fill="#f7b733" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/></g>
      ${head(48, 21)}${face(48, 21)}${mouth(48, 27)}</g>
  </g>`,
  zoo: `<g>
    <g>${legs(22)}${body(22, '#5fbf6f')}${limb('M16 37 L12 43', SKIN)}
      <g class="ic wave">${limb('M28 37 L33 29', SKIN)}</g>${head(22, 21)}${face(22, 21)}${mouth(22, 27)}</g>
    <g class="ic hop">
      <ellipse cx="48" cy="44" rx="10" ry="12.5" fill="#3d4a5c" stroke="${INK}" stroke-width="2.2"/>
      <ellipse cx="48" cy="46" rx="6.5" ry="9" fill="#fff"/>
      <circle cx="45" cy="38" r="1.5" fill="${INK}"/><circle cx="51" cy="38" r="1.5" fill="${INK}"/>
      <path d="M46 41 L48 44 L50 41 Z" fill="#f7b733" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
      <circle cx="43.5" cy="42" r="1.6" fill="${CHEEK}"/><circle cx="52.5" cy="42" r="1.6" fill="${CHEEK}"/>
      <path d="M38.5 42 L35 49 M57.5 42 L61 49" stroke="#3d4a5c" stroke-width="3.6" stroke-linecap="round"/>
      <ellipse cx="44" cy="57" rx="3.6" ry="1.8" fill="#f7b733" stroke="${INK}" stroke-width="1.4"/><ellipse cx="52" cy="57" rx="3.6" ry="1.8" fill="#f7b733" stroke="${INK}" stroke-width="1.4"/>
    </g>
  </g>`,
  sky: `<g class="ic glide">
    <path d="M4 34 Q32 28 60 31 L60 33.5 Q32 31.5 4 37 Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M10 40 Q30 34 50 38 Q52 41 48 42 L16 44 Q9 44 10 40 Z" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M10 40 L4 33 L7 32 L15 39" fill="#e2483d" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M36 37 Q41 30 47 37" fill="#7cc8f8" stroke="${INK}" stroke-width="1.8"/>
    <circle cx="40" cy="30" r="7.5" fill="${SKIN}" stroke="${INK}" stroke-width="2"/>
    <path d="M32.6 28.5 Q33 22 40 22 Q47 22 47.4 28.5 Z" fill="#e2483d" stroke="${INK}" stroke-width="1.8"/>
    <rect x="35.4" y="26.4" width="9.2" height="3.6" rx="1.8" fill="#bfe6ff" stroke="${INK}" stroke-width="1.5"/>
    <circle cx="35" cy="33" r="1.7" fill="${CHEEK}"/><circle cx="45" cy="33" r="1.7" fill="${CHEEK}"/>
    ${mouth(40, 33)}
    <g stroke="#7cc8f8" stroke-width="2" stroke-linecap="round"><path d="M56 42 h6"/><path d="M53 47 h8"/><path d="M58 37 h4"/></g>
  </g>`,
  ferry: `<g>
    <g class="ic rock">
      ${limb('M30 41 L29 48', '#5c6878')}${limb('M36 41 L37 48', '#5c6878')}
      <path d="M24 29 Q33 25 42 29 L43 42 Q33 45 23 42 Z" fill="#5fbf6f" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M52 8 L38 56" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
      ${limb('M27 32 L45 24', SKIN)}${limb('M39 33 L47 31', SKIN)}
      ${head(33, 17)}${face(33, 17)}
      <path d="M21 12 Q33 3 45 12 Q33 9 21 12 Z" fill="#f2d16b" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M8 46 H58 Q55 56 46 56 H19 Q11 56 8 46 Z" fill="#c98b4f" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M12 50 H54" stroke="#e7b27c" stroke-width="2" stroke-linecap="round"/>
    </g>
    <path d="M2 59 q4 -3 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0" fill="none" stroke="#7cc8f8" stroke-width="2.4" stroke-linecap="round"/>
  </g>`,
  museum: `<g>
    <rect x="38" y="44" width="20" height="13" fill="#f2e3c6" stroke="${INK}" stroke-width="2"/>
    <path d="M42 44 Q40 36 44 33 L44 30 H52 L52 33 Q56 36 54 44 Z" fill="#7cc8f8" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M42.5 38 H53.5" stroke="#fff" stroke-width="2"/>
    ${legs(22)}${body(22, '#9b6bb5')}${limb('M16 37 L13 43', SKIN)}
    ${head(22, 21)}${face(22, 21)}
    <g class="ic float">${limb('M28 37 L34 32', SKIN)}
      <circle cx="38" cy="27" r="6" fill="#dff3ff" fill-opacity=".8" stroke="${INK}" stroke-width="2.2"/>
      <path d="M34 31 L30 35" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>
    <g fill="#ff8a00"><path d="M58 22 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2 z"/></g>
  </g>`,
  view: `<g>
    <path d="M0 58 Q20 40 40 46 Q52 49 64 58 Z" fill="#a5dc8f" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <g class="ic float">${legs(30, '#5c6878')}${body(30, '#f7b733')}
      ${head(30, 20)}${face(30, 20)}
      <rect x="31" y="15" width="7" height="8" rx="2" fill="#3d4a5c" stroke="${INK}" stroke-width="1.6"/>
      <rect x="38" y="15" width="7" height="8" rx="2" fill="#3d4a5c" stroke="${INK}" stroke-width="1.6"/>
      ${limb('M25 36 L33 25', SKIN)}${limb('M35 36 L42 25', SKIN)}</g>
    <g stroke="#ff8a00" stroke-width="1.8" stroke-linecap="round"><path d="M50 12 l4 -2"/><path d="M51 18 h4.4"/><path d="M50 24 l4 2"/></g>
  </g>`,
  michi: `<g class="ic hop">
    ${legs(30)}${body(30, '#f7b733')}
    ${head(30, 19, '#6b4226')}${face(30, 19)}${mouth(30, 25)}
    <path d="M42 30 l3 -8 M45 30 l5 -7 M47 31 l7 -4" stroke="#5fbf6f" stroke-width="3" stroke-linecap="round"/>
    <path d="M49 30 l-2 9" stroke="#ff8a00" stroke-width="4" stroke-linecap="round"/>
    <circle cx="43" cy="34" r="3.6" fill="#e2483d" stroke="${INK}" stroke-width="1.6"/>
    <path d="M38 34 H56 L53 45 H41 Z" fill="#d89548" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M40 38 H54 M41 41.5 H53" stroke="#f0c070" stroke-width="1.4"/>
    ${limb('M38 37 L42 37', SKIN)}${limb('M22 36 L17 42', SKIN)}
  </g>`,
  beach: `<g>
    <circle cx="54" cy="10" r="6" fill="#ffd75e" stroke="${INK}" stroke-width="1.8"/>
    <g class="ic hop">${legs(30, SKIN)}${body(30, '#e2483d')}
      <ellipse cx="30" cy="42" rx="14" ry="6" fill="#ff9eb0" stroke="${INK}" stroke-width="2"/>
      <path d="M18 40 L22 44 M38 44 L42 40" stroke="#fff" stroke-width="2.4"/>
      ${limb('M19 36 L13 29', SKIN)}${limb('M41 36 L47 29', SKIN)}
      ${head(30, 21, '#6b4226')}${face(30, 21)}${mouth(30, 27)}</g>
    <path d="M2 60 q4 -3 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0" fill="none" stroke="#7cc8f8" stroke-width="2.4" stroke-linecap="round"/>
  </g>`,
  station: `<g>
    <path d="M36 57 H64 M38 60 H62" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
    <rect x="38" y="26" width="22" height="28" rx="6" fill="#5fbf6f" stroke="${INK}" stroke-width="2.2"/>
    <rect x="41.5" y="30" width="15" height="10" rx="2" fill="#bfe6ff" stroke="${INK}" stroke-width="1.6"/>
    <path d="M38 44 H60" stroke="#fff" stroke-width="2.4"/>
    <circle cx="43" cy="49.5" r="2" fill="#ffd75e" stroke="${INK}" stroke-width="1.2"/><circle cx="55" cy="49.5" r="2" fill="#ffd75e" stroke="${INK}" stroke-width="1.2"/>
    <g fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"><path d="M45 35 q1.5 -2 3 0"/><path d="M50 35 q1.5 -2 3 0"/></g>
    ${legs(20)}${body(20, '#7cc8f8')}${limb('M14 37 L11 43', SKIN)}
    <g class="ic wave">${limb('M26 37 L31 28', SKIN)}</g>${head(20, 21)}${face(20, 21)}${mouth(20, 27)}
  </g>`,
  library: `<g class="ic munch">
    ${legs(32)}${body(32, '#7cc8f8')}
    ${head(32, 18)}${face(32, 18, 'closed')}
    <path d="M32 32 Q24 28 16 30 V44 Q24 42 32 46 Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 32 Q40 28 48 30 V44 Q40 42 32 46 Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M19 34 Q24 33 29 35 M19 38 Q24 37 29 39 M35 35 Q40 33 45 34 M35 39 Q40 37 45 38" stroke="#b9c3d0" stroke-width="1.4" fill="none"/>
    <circle cx="16" cy="38" r="3" fill="${SKIN}" stroke="${INK}" stroke-width="1.6"/><circle cx="48" cy="38" r="3" fill="${SKIN}" stroke="${INK}" stroke-width="1.6"/>
  </g>`,
  park: `<g>
    <rect x="9" y="40" width="5" height="17" fill="#8a5a33" stroke="${INK}" stroke-width="1.8"/>
    <circle cx="11.5" cy="30" r="11" fill="#5fbf6f" stroke="${INK}" stroke-width="2"/>
    <circle cx="7" cy="27" r="2" fill="#a5dc8f"/><circle cx="15" cy="33" r="1.6" fill="#a5dc8f"/>
    <g class="ic hop">${legs(36)}${body(36, '#ff9eb0')}${limb('M30 37 L27 43', SKIN)}
      ${limb('M42 37 L48 28', SKIN)}<path d="M48 28 L52 14" stroke="${INK}" stroke-width="1.4"/>
      ${head(36, 21)}${face(36, 21)}${mouth(36, 27)}</g>
    <g class="ic float"><ellipse cx="53" cy="9" rx="6" ry="7" fill="#e2483d" stroke="${INK}" stroke-width="1.8"/>
      <path d="M50.5 6 q1 -2 3 -2" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>
  </g>`,
  bus: `<g class="ic bob">
    <path d="M6 14 Q6 6 14 6 H44 Q54 6 57 15 L58 24 Q58 28 54 28 H10 Q6 28 6 24 Z" fill="#fff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M6 19 H58" stroke="#e2483d" stroke-width="3"/>
    <rect x="11" y="9" width="9" height="7" rx="1.5" fill="#bfe6ff" stroke="${INK}" stroke-width="1.6"/>
    <rect x="23" y="9" width="9" height="7" rx="1.5" fill="#bfe6ff" stroke="${INK}" stroke-width="1.6"/>
    <path d="M36 9 H46 Q51 9 53 16 H36 Z" fill="#bfe6ff" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    <g fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"><path d="M41.5 13.2 q1.5 -2 3 0"/><path d="M47 13.2 q1.5 -2 3 0"/></g>
    <circle cx="40.5" cy="15" r="1.4" fill="${CHEEK}"/><circle cx="52" cy="15" r="1.4" fill="${CHEEK}"/>
    <circle cx="17" cy="28" r="4.6" fill="#5c6878" stroke="${INK}" stroke-width="2"/><circle cx="47" cy="28" r="4.6" fill="#5c6878" stroke="${INK}" stroke-width="2"/>
  </g>`,
};
const CAT_LABEL = { castle: 'お城', zoo: '動物園・水族館', sky: '空港・滑空場', ferry: '船', onsen: '温泉・銭湯', museum: '博物館・美術館', view: '展望', michi: '道の駅',
  beach: '海辺', jinja: '神社', tera: 'お寺', station: '駅', library: '図書館', park: '公園' };

// ガチャガチャの機械（200×270）。.handle が回り、.caps がゆれる
const CAPSULE = (cx, cy, c, r = 12) => `<g><path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy} Z" fill="${c}" stroke="${INK}" stroke-width="2"/>
  <path d="M${cx - r} ${cy} A${r} ${r} 0 0 0 ${cx + r} ${cy} Z" fill="#fff" stroke="${INK}" stroke-width="2"/>
  <path d="M${cx - r * .55} ${cy - r * .45} q${r * .2} -${r * .3} ${r * .5} -${r * .35}" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/></g>`;
const MACHINE = `<svg viewBox="0 0 200 270" class="machine" aria-label="ガチャガチャの機械">
  <ellipse cx="100" cy="262" rx="80" ry="7" fill="rgba(0,0,0,.25)"/>
  <rect x="34" y="6" width="132" height="22" rx="9" fill="#e2483d" stroke="${INK}" stroke-width="3"/>
  <rect x="60" y="11" width="80" height="12" rx="6" fill="#fff3c4" stroke="${INK}" stroke-width="2"/>
  <text x="100" y="20.5" text-anchor="middle" font-size="10" font-weight="900" fill="${INK}" letter-spacing="1">COMIBUS</text>
  <rect x="28" y="26" width="144" height="118" rx="16" fill="#dff3ff" fill-opacity=".85" stroke="${INK}" stroke-width="3"/>
  <g class="caps">
    ${CAPSULE(52, 126, '#ff9eb0')}${CAPSULE(78, 128, '#7cc8f8')}${CAPSULE(104, 126, '#ffd75e')}${CAPSULE(130, 128, '#5fbf6f')}${CAPSULE(154, 125, '#e2483d')}
    ${CAPSULE(64, 104, '#ffd75e')}${CAPSULE(90, 105, '#e2483d')}${CAPSULE(116, 103, '#9b6bb5')}${CAPSULE(142, 104, '#7cc8f8')}
    ${CAPSULE(52, 82, '#5fbf6f')}${CAPSULE(78, 83, '#ff9eb0')}${CAPSULE(104, 81, '#7cc8f8')}${CAPSULE(130, 83, '#ffd75e')}${CAPSULE(152, 82, '#ff9eb0')}
    ${CAPSULE(90, 60, '#9b6bb5')}${CAPSULE(118, 61, '#e2483d')}
  </g>
  <path d="M40 36 Q36 60 40 80" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none" opacity=".75"/>
  <path d="M22 142 H178 L172 252 Q171 258 165 258 H35 Q29 258 28 252 Z" fill="#e2483d" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <rect x="38" y="152" width="124" height="34" rx="8" fill="#fff3c4" stroke="${INK}" stroke-width="2.4"/>
  <g transform="translate(46 156) scale(.42)">${ICONS.bus.replace('class="ic bob"', '')}</g>
  <text x="104" y="168" text-anchor="middle" font-size="12" font-weight="900" fill="${INK}">1かい</text>
  <text x="104" y="181" text-anchor="middle" font-size="11" font-weight="900" fill="#e2483d">500円まで</text>
  <rect x="141" y="160" width="14" height="20" rx="3" fill="#9aa3ad" stroke="${INK}" stroke-width="2"/><rect x="146.5" y="163" width="3" height="14" rx="1.5" fill="${INK}"/>
  <g class="handle"><circle cx="100" cy="212" r="22" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <rect x="80" y="207" width="40" height="10" rx="5" fill="#f7b733" stroke="${INK}" stroke-width="2.4"/>
    <circle cx="100" cy="212" r="4" fill="${INK}"/></g>
  <rect x="78" y="238" width="44" height="16" rx="5" fill="#3a2a20" stroke="${INK}" stroke-width="2.4"/>
  <path d="M80 240 H120" stroke="#5c4636" stroke-width="3"/>
  <g fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"><path d="M48 228 q4 -4 8 0"/><path d="M144 228 q4 -4 8 0"/></g>
  <circle cx="44" cy="236" r="4" fill="${CHEEK}"/><circle cx="156" cy="236" r="4" fill="${CHEEK}"/>
</svg>`;
