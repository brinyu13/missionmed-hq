/* ============================================================
   3528B — Semantic scene art (original MissionMed prototype art)
   Every scene answers "what does clicking this do?" with no text.
   One visual universe: navy night world, warm practice-room light,
   cyan/gold rim lighting, clean silhouette figures.
   All art is original SVG — no Epic/Fortnite assets or trade dress.
   ============================================================ */

const DEFS = `
<defs>
  <linearGradient id="skyN" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0a1226"/><stop offset=".55" stop-color="#0d1730"/><stop offset="1" stop-color="#101c38"/>
  </linearGradient>
  <linearGradient id="roomWarm" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1a2033"/><stop offset="1" stop-color="#242438"/>
  </linearGradient>
  <radialGradient id="glowGold" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#ffc24b" stop-opacity=".85"/><stop offset=".4" stop-color="#ffb300" stop-opacity=".28"/><stop offset="1" stop-color="#ffb300" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glowCyan" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#9fe9ff" stop-opacity=".9"/><stop offset=".35" stop-color="#39d6ff" stop-opacity=".3"/><stop offset="1" stop-color="#39d6ff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glowTeal" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#b7ffe9" stop-opacity=".9"/><stop offset=".35" stop-color="#2fe7b0" stop-opacity=".3"/><stop offset="1" stop-color="#2fe7b0" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glowRed" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#ff8d98" stop-opacity=".95"/><stop offset=".4" stop-color="#ff4d5e" stop-opacity=".35"/><stop offset="1" stop-color="#ff4d5e" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="screenLit" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2c4a6e"/><stop offset="1" stop-color="#16283f"/>
  </linearGradient>
  <linearGradient id="floorSheen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#131a2c"/><stop offset="1" stop-color="#0a0f1e"/>
  </linearGradient>
  <linearGradient id="cardFace" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#223050"/><stop offset="1" stop-color="#182338"/>
  </linearGradient>
  <linearGradient id="goldBeam" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffc24b" stop-opacity=".35"/><stop offset="1" stop-color="#ffc24b" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="cyanBeam" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#39d6ff" stop-opacity=".3"/><stop offset="1" stop-color="#39d6ff" stop-opacity="0"/>
  </linearGradient>
  <filter id="soft2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="soft6" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="soft14" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="14"/></filter>
  <radialGradient id="vig" cx=".5" cy=".42" r=".75">
    <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#02040a" stop-opacity=".72"/>
  </radialGradient>
</defs>`;

/* -- shared pieces -------------------------------------------------- */

// Seated / standing figure silhouette with cyan+gold rim light.
// pose: 'seated' | 'standing'; facing: 1 (right) | -1 (left)
function figure({ x, y, s = 1, pose = 'seated', facing = 1, rim = '#39d6ff', body = '#0b1122', warm = '#ffc24b' }) {
  const f = facing;
  const torso = pose === 'seated'
    ? `M ${-34 * f} 74 C ${-40 * f} 30 ${-26 * f} 6 0 0 C ${28 * f} 6 ${40 * f} 34 ${36 * f} 74 L ${-34 * f} 74 Z`
    : `M ${-30 * f} 128 C ${-38 * f} 44 ${-26 * f} 6 0 0 C ${28 * f} 6 ${38 * f} 48 ${32 * f} 128 L ${-30 * f} 128 Z`;
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="${pose === 'seated' ? 86 : 140}" rx="52" ry="10" fill="#000" opacity=".4" filter="url(#soft6)"/>
    <path d="${torso}" fill="${body}"/>
    <circle cx="${2 * f}" cy="-26" r="24" fill="${body}"/>
    <path d="M ${2 * f} -50 A 24 24 0 0 ${f === 1 ? 1 : 0} ${26 * f} -24" fill="none" stroke="${rim}" stroke-width="3.5" stroke-linecap="round" opacity=".95"/>
    <path d="${pose === 'seated'
      ? `M ${30 * f} 8 C ${40 * f} 26 ${42 * f} 48 ${38 * f} 72`
      : `M ${26 * f} 10 C ${38 * f} 40 ${40 * f} 80 ${34 * f} 124`}"
      fill="none" stroke="${rim}" stroke-width="3" stroke-linecap="round" opacity=".8"/>
    <path d="${pose === 'seated'
      ? `M ${-28 * f} 10 C ${-36 * f} 30 ${-38 * f} 52 ${-34 * f} 72`
      : `M ${-24 * f} 12 C ${-34 * f} 44 ${-36 * f} 84 ${-30 * f} 124`}"
      fill="none" stroke="${warm}" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>
  </g>`;
}

// Camera on tripod pointing left or right
function cameraRig({ x, y, s = 1, facing = -1, lamp = '#ff4d5e', lampOn = true }) {
  const f = facing;
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M -3 40 L -26 108 M 3 40 L 26 108 M 0 44 L 0 106" stroke="#25304a" stroke-width="6" stroke-linecap="round"/>
    <rect x="${f === -1 ? -58 : -18}" y="-8" width="76" height="48" rx="10" fill="#1b2438"/>
    <rect x="${f === -1 ? -58 : -18}" y="-8" width="76" height="48" rx="10" fill="none" stroke="#39d6ff" stroke-width="2" opacity=".5"/>
    <circle cx="${f * 66}" cy="16" r="17" fill="#0c1424"/>
    <circle cx="${f * 66}" cy="16" r="17" fill="none" stroke="#39d6ff" stroke-width="2.5" opacity=".9"/>
    <circle cx="${f * 62}" cy="12" r="5" fill="#9fe9ff" opacity=".9"/>
    ${lampOn ? `<circle cx="${f === -1 ? 12 : -12}" cy="-16" r="6" fill="${lamp}"/>
    <circle cx="${f === -1 ? 12 : -12}" cy="-16" r="14" fill="url(#glowRed)"/>` : ''}
  </g>`;
}

// Floating question card
function qCard({ x, y, w = 120, h = 76, tilt = 0, hot = false, glyph = true }) {
  return `
  <g transform="translate(${x} ${y}) rotate(${tilt})">
    <rect x="0" y="0" width="${w}" height="${h}" rx="9" fill="url(#cardFace)" stroke="${hot ? '#ffc24b' : '#33415f'}" stroke-width="${hot ? 2.5 : 1.5}"/>
    ${hot ? `<rect x="-8" y="-8" width="${w + 16}" height="${h + 16}" rx="13" fill="none" stroke="#ffc24b" stroke-width="1" opacity=".35"/>` : ''}
    ${glyph ? `<text x="${w / 2}" y="${h / 2 + 14}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${h * .58}" fill="${hot ? '#ffc24b' : '#4d6288'}">?</text>` : `
    <rect x="12" y="16" width="${w - 40}" height="7" rx="3.5" fill="#42557c"/>
    <rect x="12" y="32" width="${w - 24}" height="7" rx="3.5" fill="#35466a"/>
    <rect x="12" y="48" width="${w - 56}" height="7" rx="3.5" fill="#2c3c5c"/>`}
  </g>`;
}

const GRAIN = `<rect width="800" height="500" fill="url(#vig)"/>`;

function wrap(inner) {
  return `<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">${DEFS}${inner}${GRAIN}</svg>`;
}

/* -- scenes --------------------------------------------------------- */

/* QUICK PRACTICE — applicant drops straight into the lit practice bay:
   one glowing question card, camera already rolling. Immediate. */
function sceneQuick() {
  return wrap(`
  <rect width="800" height="500" fill="url(#roomWarm)"/>
  <rect y="360" width="800" height="140" fill="url(#floorSheen)"/>
  <ellipse cx="470" cy="200" rx="330" ry="240" fill="url(#glowGold)" opacity=".5"/>
  <path d="M330 0 L560 0 L640 360 L250 360 Z" fill="url(#goldBeam)"/>
  <circle cx="452" cy="64" r="26" fill="#0e1526" stroke="#39d6ff" stroke-width="2" opacity=".9"/>
  <circle cx="452" cy="64" r="12" fill="#ffdf9a" opacity=".95"/>
  <circle cx="452" cy="64" r="52" fill="url(#glowGold)"/>
  ${qCard({ x: 470, y: 120, w: 150, h: 96, tilt: 6, hot: true })}
  <g transform="translate(560 240)">
    <rect x="-10" y="86" width="150" height="14" rx="4" fill="#101728"/>
    <rect x="0" y="20" width="128" height="72" rx="8" fill="#0d1526" stroke="#2b3548" stroke-width="2"/>
  </g>
  ${cameraRig({ x: 620, y: 210, s: 1.06, facing: -1 })}
  ${figure({ x: 330, y: 268, s: 1.55, pose: 'seated', facing: 1 })}
  <path d="M212 96 L228 132 L204 132 L220 168" fill="none" stroke="#ffd63d" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="218" cy="132" r="56" fill="url(#glowGold)" opacity=".8"/>
  `);
}

/* QUESTION PRACTICE — a wall of category-lit question cards, the
   applicant reaching to pick one exact card. Targeted drill. */
function sceneQuestion() {
  return wrap(`
  <rect width="800" height="500" fill="url(#skyN)"/>
  <rect y="380" width="800" height="120" fill="url(#floorSheen)"/>
  <ellipse cx="420" cy="180" rx="360" ry="230" fill="url(#glowCyan)" opacity=".35"/>
  ${qCard({ x: 120, y: 66, w: 118, h: 74, tilt: -5, glyph: false })}
  ${qCard({ x: 268, y: 46, w: 118, h: 74, tilt: 2, glyph: false })}
  ${qCard({ x: 416, y: 60, w: 118, h: 74, tilt: -2, glyph: false })}
  ${qCard({ x: 566, y: 44, w: 118, h: 74, tilt: 4, glyph: false })}
  ${qCard({ x: 140, y: 168, w: 118, h: 74, tilt: 3, glyph: false })}
  ${qCard({ x: 292, y: 158, w: 150, h: 96, tilt: -3, hot: true })}
  ${qCard({ x: 486, y: 166, w: 118, h: 74, tilt: -4, glyph: false })}
  ${qCard({ x: 632, y: 158, w: 118, h: 74, tilt: 5, glyph: false })}
  <circle cx="368" cy="206" r="90" fill="url(#glowGold)" opacity=".65"/>
  <path d="M 330 330 C 344 296 356 268 366 252" stroke="#ffc24b" stroke-width="4" stroke-linecap="round" fill="none" opacity=".9"/>
  <circle cx="368" cy="248" r="7" fill="#ffd63d"/>
  ${figure({ x: 300, y: 372, s: 1.5, pose: 'standing', facing: 1 })}
  `);
}

/* SELF MOCK INTERVIEW — the formal room: interviewer across the desk,
   applicant answering, REC lamp burning. Full-dress rehearsal. */
function sceneMock() {
  return wrap(`
  <rect width="800" height="500" fill="url(#roomWarm)"/>
  <g opacity=".8">
    <rect x="470" y="26" width="300" height="180" rx="8" fill="#0e1930"/>
    ${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="476" y="${34 + i * 25}" width="288" height="10" rx="3" fill="#1c2c4a"/>`).join('')}
    <rect x="470" y="26" width="300" height="180" rx="8" fill="none" stroke="#2b3548" stroke-width="2"/>
  </g>
  <rect y="368" width="800" height="132" fill="url(#floorSheen)"/>
  <ellipse cx="400" cy="300" rx="360" ry="200" fill="url(#glowGold)" opacity=".4"/>
  <path d="M 120 368 L 680 368 L 640 300 L 160 300 Z" fill="#1a2338"/>
  <path d="M 160 300 L 640 300 L 630 292 L 170 292 Z" fill="#2b3a58"/>
  ${figure({ x: 236, y: 218, s: 1.42, pose: 'seated', facing: 1, rim: '#ffc24b', warm: '#39d6ff' })}
  ${figure({ x: 566, y: 212, s: 1.48, pose: 'seated', facing: -1 })}
  <g transform="translate(400 250)">
    <rect x="-26" y="0" width="52" height="34" rx="6" fill="#101a2e" stroke="#33415f" stroke-width="1.5"/>
    <path d="M -8 10 L 12 17 L -8 24 Z" fill="#ffc24b"/>
  </g>
  <circle cx="700" cy="70" r="9" fill="#ff4d5e"/>
  <circle cx="700" cy="70" r="24" fill="url(#glowRed)"/>
  `);
}

/* VIDEO LIBRARY — a dark archive wall of glowing replay frames,
   one selected and playing. Your recordings live here. */
function sceneLibrary() {
  const frame = (x, y, w, h, on = false) => `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${on ? 'url(#screenLit)' : '#101a30'}" stroke="${on ? '#ffc24b' : '#243350'}" stroke-width="${on ? 2.5 : 1.2}"/>
    ${on ? `<path d="M ${x + w / 2 - 9} ${y + h / 2 - 13} L ${x + w / 2 + 13} ${y + h / 2} L ${x + w / 2 - 9} ${y + h / 2 + 13} Z" fill="#ffd63d"/>
    <rect x="${x + 8}" y="${y + h - 12}" width="${w - 16}" height="4" rx="2" fill="#0b1122"/>
    <rect x="${x + 8}" y="${y + h - 12}" width="${(w - 16) * .6}" height="4" rx="2" fill="#ffc24b"/>` :
    `<path d="M ${x + w / 2 - 6} ${y + h / 2 - 9} L ${x + w / 2 + 9} ${y + h / 2} L ${x + w / 2 - 6} ${y + h / 2 + 9} Z" fill="#3d5378" opacity=".9"/>`}`;
  return wrap(`
  <rect width="800" height="500" fill="#080c18"/>
  <ellipse cx="400" cy="240" rx="380" ry="260" fill="url(#glowCyan)" opacity=".2"/>
  ${frame(60, 60, 152, 92)} ${frame(238, 52, 152, 92)} ${frame(416, 60, 152, 92)} ${frame(594, 52, 152, 92)}
  ${frame(60, 296, 152, 92)} ${frame(238, 304, 152, 92)} ${frame(416, 296, 152, 92)} ${frame(594, 304, 152, 92)}
  ${frame(214, 168, 372, 118, true)}
  <ellipse cx="400" cy="228" rx="240" ry="120" fill="url(#glowGold)" opacity=".35"/>
  <rect y="424" width="800" height="76" fill="url(#floorSheen)"/>
  ${figure({ x: 128, y: 386, s: 1.0, pose: 'standing', facing: 1 })}
  `);
}

/* RESULTS — the debrief: replay frame + three big score plates and a
   rising trace. Performance breakdown of one interview. */
function sceneResults() {
  return wrap(`
  <rect width="800" height="500" fill="url(#skyN)"/>
  <ellipse cx="300" cy="220" rx="340" ry="240" fill="url(#glowTeal)" opacity=".3"/>
  <g>
    <rect x="80" y="90" width="330" height="200" rx="10" fill="url(#screenLit)" stroke="#33415f" stroke-width="2"/>
    ${figure({ x: 245, y: 208, s: 1.02, pose: 'seated', facing: 1 })}
    <path d="M 231 172 L 259 190 L 231 208 Z" fill="#ffd63d" opacity=".95"/>
    <rect x="96" y="266" width="298" height="6" rx="3" fill="#0b1122"/>
    <rect x="96" y="266" width="200" height="6" rx="3" fill="#2fe7b0"/>
  </g>
  <g font-family="'Space Grotesk',monospace" font-weight="700" text-anchor="middle">
    <rect x="470" y="84" width="92" height="108" rx="10" fill="#12233a" stroke="#2fe7b0" stroke-width="2"/>
    <text x="516" y="150" font-size="44" fill="#2fe7b0">8</text>
    <rect x="578" y="104" width="92" height="108" rx="10" fill="#1d2337" stroke="#ffc24b" stroke-width="2"/>
    <text x="624" y="170" font-size="44" fill="#ffc24b">6</text>
    <rect x="686" y="84" width="92" height="108" rx="10" fill="#12233a" stroke="#2fe7b0" stroke-width="2"/>
    <text x="732" y="150" font-size="44" fill="#2fe7b0">7</text>
  </g>
  <path d="M 470 400 C 540 392 560 350 610 344 C 660 338 680 300 770 286" fill="none" stroke="#39d6ff" stroke-width="4" stroke-linecap="round"/>
  <circle cx="770" cy="286" r="7" fill="#9fe9ff"/>
  <circle cx="770" cy="286" r="26" fill="url(#glowCyan)"/>
  <path d="M 470 430 C 550 428 600 410 770 402" fill="none" stroke="#a696ff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <rect x="80" y="330" width="330" height="88" rx="10" fill="#101a30" stroke="#243350" stroke-width="1.5"/>
  ${[0, 1, 2, 3].map(i => `<rect x="${96 + i * 78}" y="${346 + (i % 2) * 8}" width="62" height="${48 - (i % 2) * 8}" rx="6" fill="#1b2c48"/><circle cx="${127 + i * 78}" cy="${362 + (i % 2) * 6}" r="8" fill="${['#2fe7b0', '#ffc24b', '#39d6ff', '#a696ff'][i]}" opacity=".9"/>`).join('')}
  `);
}

/* PROGRESS — many sessions climbing: milestone pylons, rising trace,
   summit flag. Your trajectory. */
function sceneProgress() {
  const py = (x, y, h, on) => `
    <rect x="${x}" y="${y - h}" width="34" height="${h}" rx="6" fill="${on ? '#1d2c48' : '#141d33'}" stroke="${on ? '#ffc24b' : '#243350'}" stroke-width="${on ? 2 : 1.2}"/>
    <circle cx="${x + 17}" cy="${y - h - 14}" r="${on ? 7 : 5}" fill="${on ? '#ffd63d' : '#39d6ff'}" opacity="${on ? 1 : .6}"/>`;
  return wrap(`
  <rect width="800" height="500" fill="url(#skyN)"/>
  <ellipse cx="620" cy="120" rx="300" ry="200" fill="url(#glowGold)" opacity=".35"/>
  <rect y="400" width="800" height="100" fill="url(#floorSheen)"/>
  ${py(120, 400, 70, false)} ${py(230, 400, 110, false)} ${py(340, 400, 96, false)}
  ${py(450, 400, 160, true)} ${py(560, 400, 200, true)} ${py(670, 400, 262, true)}
  <path d="M 120 330 C 210 300 240 292 264 288 C 320 296 330 300 357 296 C 420 264 440 244 467 236 C 520 212 540 200 577 192 C 630 160 650 148 687 130"
    fill="none" stroke="#39d6ff" stroke-width="4.5" stroke-linecap="round"/>
  <circle cx="687" cy="130" r="8" fill="#9fe9ff"/>
  <circle cx="687" cy="130" r="30" fill="url(#glowCyan)"/>
  <path d="M 687 96 L 687 56 L 730 68 L 687 82" fill="#ffc24b"/>
  <path d="M 687 96 L 687 52" stroke="#ffd63d" stroke-width="3" stroke-linecap="round"/>
  ${figure({ x: 96, y: 368, s: .92, pose: 'standing', facing: 1 })}
  `);
}

/* SETUP — the calibration bench: camera, mic, headset, level rings.
   Get your gear right. */
function sceneSetup() {
  return wrap(`
  <rect width="800" height="500" fill="url(#roomWarm)"/>
  <rect y="360" width="800" height="140" fill="url(#floorSheen)"/>
  <ellipse cx="400" cy="250" rx="340" ry="200" fill="url(#glowCyan)" opacity=".3"/>
  <path d="M 110 360 L 690 360 L 660 306 L 140 306 Z" fill="#1a2338"/>
  <path d="M 140 306 L 660 306 L 652 298 L 148 298 Z" fill="#2b3a58"/>
  ${cameraRig({ x: 250, y: 200, s: 1.25, facing: 1, lampOn: false })}
  <g transform="translate(430 208)">
    <path d="M 0 96 L 0 54" stroke="#25304a" stroke-width="7" stroke-linecap="round"/>
    <path d="M -22 46 L 22 46" stroke="#25304a" stroke-width="6" stroke-linecap="round"/>
    <rect x="-17" y="-24" width="34" height="62" rx="17" fill="#1b2438" stroke="#39d6ff" stroke-width="2"/>
    ${[-8, 0, 8].map(i => `<rect x="${i - 2}" y="-12" width="4" height="38" rx="2" fill="#0c1424"/>`).join('')}
    <circle cx="0" cy="8" r="52" fill="url(#glowCyan)" opacity=".5"/>
  </g>
  <g transform="translate(560 230)" fill="none" stroke-linecap="round">
    <path d="M -34 40 A 40 40 0 1 1 46 40" stroke="#1b2438" stroke-width="13"/>
    <path d="M -34 40 A 40 40 0 1 1 46 40" stroke="#ffc24b" stroke-width="4" opacity=".85"/>
    <rect x="-46" y="34" width="24" height="34" rx="9" fill="#1b2438" stroke="#ffc24b" stroke-width="2.5"/>
    <rect x="28" y="34" width="24" height="34" rx="9" fill="#1b2438" stroke="#ffc24b" stroke-width="2.5"/>
  </g>
  <g stroke-linecap="round">
    ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${172 + i * 13}" y="${266 - Math.min(30, 6 + i * 5)}" width="8" height="${Math.min(30, 6 + i * 5)}" rx="3" fill="${i < 6 ? '#2fe7b0' : '#1f3a4e'}"/>`).join('')}
  </g>
  <circle cx="250" cy="140" r="70" fill="none" stroke="#39d6ff" stroke-width="1.5" opacity=".4"/>
  <circle cx="250" cy="140" r="94" fill="none" stroke="#39d6ff" stroke-width="1" opacity=".22"/>
  `);
}

/* MENTOR REVIEW — the mentor at a review console: student replay large,
   annotation ticks going on. */
function sceneMentor() {
  return wrap(`
  <rect width="800" height="500" fill="url(#skyN)"/>
  <ellipse cx="430" cy="200" rx="360" ry="240" fill="url(#glowCyan)" opacity=".25"/>
  <g>
    <rect x="210" y="56" width="420" height="252" rx="12" fill="url(#screenLit)" stroke="#33415f" stroke-width="2.5"/>
    ${figure({ x: 420, y: 210, s: 1.28, pose: 'seated', facing: -1 })}
    <rect x="228" y="284" width="384" height="7" rx="3.5" fill="#0b1122"/>
    <rect x="228" y="284" width="230" height="7" rx="3.5" fill="#ffc24b"/>
    <circle cx="458" cy="287" r="7" fill="#ffd63d"/>
  </g>
  <g font-family="'Space Grotesk',monospace" font-weight="700">
    <rect x="648" y="86" width="112" height="52" rx="9" fill="#12233a" stroke="#2fe7b0" stroke-width="2"/>
    <path d="M 664 112 L 674 122 L 694 100" stroke="#2fe7b0" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="648" y="152" width="112" height="52" rx="9" fill="#1d2337" stroke="#ffc24b" stroke-width="2"/>
    <path d="M 664 178 L 694 178 M 679 163 L 679 193" stroke="#ffc24b" stroke-width="5" stroke-linecap="round"/>
    <rect x="648" y="218" width="112" height="52" rx="9" fill="#12233a" stroke="#39d6ff" stroke-width="2"/>
    <path d="M 662 244 L 746 244" stroke="#39d6ff" stroke-width="4" stroke-linecap="round" opacity=".8"/>
  </g>
  <rect y="404" width="800" height="96" fill="url(#floorSheen)"/>
  ${figure({ x: 150, y: 330, s: 1.35, pose: 'seated', facing: 1, rim: '#a696ff' })}
  <path d="M 210 356 L 610 356 L 590 320 L 230 320 Z" fill="#151e33"/>
  `);
}

const SCENES = {
  quick: sceneQuick,
  question: sceneQuestion,
  mock: sceneMock,
  library: sceneLibrary,
  results: sceneResults,
  progress: sceneProgress,
  setup: sceneSetup,
  mentor: sceneMentor,
};

const cache = new Map();
export function sceneArt(id) {
  if (!cache.has(id)) cache.set(id, (SCENES[id] || sceneQuick)());
  return cache.get(id);
}

export function sceneDataUri(id) {
  const enc = encodeURIComponent(sceneArt(id)).replace(/'/g, '%27');
  return `url('data:image/svg+xml,${enc}')`;
}
