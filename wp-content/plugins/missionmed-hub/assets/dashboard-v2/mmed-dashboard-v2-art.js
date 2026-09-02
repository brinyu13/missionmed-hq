/* Matrix Dashboard 2.0 · built-in card art (original SVG compositions, MX-DASH-6000C).
   Cinematic, purpose-specific, no third-party IP. Each function takes a unique id prefix so
   gradient/filter ids never collide when several instances share a page.
   Exposed as window.MMED_DASH_ART; consumed by mmed-dashboard-v2.js. */
(function () {
	'use strict';

	const open = (u, defs) => `<svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs>
	<filter id="${u}b1" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>
	<filter id="${u}b2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>
	<filter id="${u}b3" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="34"/></filter>
	<radialGradient id="${u}vig" cx=".5" cy=".5" r=".72"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>
	${defs}</defs>`;
	const vignette = (u) => `<rect width="640" height="400" fill="url(#${u}vig)"/>`;
	const stars = (seed, n, color, maxR) => {
		let s = seed; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
		let out = '';
		for (let i = 0; i < n; i++) out += `<circle cx="${(r() * 640).toFixed(1)}" cy="${(r() * 400).toFixed(1)}" r="${(0.5 + r() * maxR).toFixed(2)}" fill="${color}" opacity="${(0.25 + r() * 0.7).toFixed(2)}"/>`;
		return out;
	};
	const floor = (u, color, y0, y1, cols) => {
		let out = `<g stroke="${color}" stroke-opacity=".22" stroke-width="1">`;
		for (let i = 0; i <= cols; i++) { const x = (i / cols) * 640; const xv = 320 + (x - 320) * 0.18; out += `<line x1="${xv.toFixed(1)}" y1="${y0}" x2="${x.toFixed(1)}" y2="${y1}"/>`; }
		for (let k = 0; k < 7; k++) { const t = Math.pow(k / 7, 2.2); const y = y0 + (y1 - y0) * t; out += `<line x1="0" y1="${y.toFixed(1)}" x2="640" y2="${y.toFixed(1)}" stroke-opacity="${(0.08 + t * 0.2).toFixed(2)}"/>`; }
		return out + '</g>';
	};
	const rays = (u, cx, cy, color, count, spread, len, op) => {
		let out = `<g fill="${color}" opacity="${op}">`;
		for (let i = 0; i < count; i++) { const a = -90 + (i - (count - 1) / 2) * spread; out += `<polygon points="${cx},${cy} ${cx - 18},${cy - len} ${cx + 18},${cy - len}" transform="rotate(${a} ${cx} ${cy})"/>`; }
		return out + '</g>';
	};

	const ART = {};

	/* HomeBase — command deck: perspective floor, lit beacon column, destination trails */
	ART.homebase = (u) => open(u, `
	<linearGradient id="${u}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03202b"/><stop offset=".5" stop-color="#083b4a"/><stop offset="1" stop-color="#03131f"/></linearGradient>
	<linearGradient id="${u}col" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4" stop-opacity="0"/><stop offset=".55" stop-color="#ffd76a" stop-opacity=".85"/><stop offset="1" stop-color="#ffb340" stop-opacity="0"/></linearGradient>
	<linearGradient id="${u}tr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5cf0dc" stop-opacity="0"/><stop offset="1" stop-color="#5cf0dc"/></linearGradient>
	<radialGradient id="${u}glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d6"/><stop offset=".3" stop-color="#ffd76a"/><stop offset="1" stop-color="#ffb340" stop-opacity="0"/></radialGradient>`) + `
	<rect width="640" height="400" fill="url(#${u}bg)"/>
	${stars(11, 70, '#bff5ec', 1.2)}
	<ellipse cx="320" cy="250" rx="300" ry="120" fill="#22c9b3" opacity=".22" filter="url(#${u}b3)"/>
	${floor(u, '#7fe3d3', 250, 400, 14)}
	<g fill="none" stroke="#7fe3d3" stroke-opacity=".28">${[46, 92, 148, 214].map(r => `<ellipse cx="320" cy="250" rx="${r * 1.55}" ry="${r * 0.5}"/>`).join('')}</g>
	<g fill="none" stroke-width="3" stroke-linecap="round">
		<path d="M30 40 C 200 40, 280 160, 316 236" stroke="url(#${u}tr)"/>
		<path d="M610 30 C 520 120, 420 160, 326 236" stroke="url(#${u}tr)"/>
		<path d="M10 300 C 150 300, 260 268, 314 250" stroke="url(#${u}tr)" opacity=".7"/>
		<path d="M630 330 C 520 320, 400 280, 328 252" stroke="url(#${u}tr)" opacity=".7"/>
	</g>
	<g fill="#062a34" stroke="#8ff0e3" stroke-width="1.6"><rect x="16" y="26" width="48" height="26" rx="7"/><rect x="580" y="16" width="48" height="26" rx="7"/><rect x="0" y="288" width="48" height="26" rx="7"/><rect x="600" y="318" width="48" height="26" rx="7"/></g>
	<g fill="#8ff0e3"><rect x="26" y="36" width="24" height="5" rx="2.5" opacity=".9"/><rect x="590" y="26" width="24" height="5" rx="2.5" opacity=".9"/><rect x="10" y="298" width="24" height="5" rx="2.5" opacity=".9"/><rect x="610" y="328" width="24" height="5" rx="2.5" opacity=".9"/></g>
	<rect x="304" y="30" width="32" height="230" fill="url(#${u}col)" filter="url(#${u}b1)"/>
	<rect x="312" y="60" width="16" height="200" fill="url(#${u}col)"/>
	<circle cx="320" cy="250" r="70" fill="url(#${u}glow)" opacity=".7" filter="url(#${u}b2)"/>
	<circle cx="320" cy="250" r="16" fill="#fff8e1"/><ellipse cx="320" cy="250" rx="34" ry="12" fill="none" stroke="#ffd76a" stroke-width="2"/><ellipse cx="320" cy="250" rx="56" ry="19" fill="none" stroke="#ffd76a" stroke-opacity=".4" stroke-width="1.5"/>
	${vignette(u)}</svg>`;

	/* Calendar — a canyon of glowing time slabs with a beam marking now */
	ART.calendar = (u) => open(u, `
	<linearGradient id="${u}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03142a"/><stop offset=".55" stop-color="#0a3d6b"/><stop offset="1" stop-color="#020a16"/></linearGradient>
	<linearGradient id="${u}slab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9ecff"/><stop offset="1" stop-color="#1b9be0"/></linearGradient>
	<linearGradient id="${u}dim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd8ff" stop-opacity=".5"/><stop offset="1" stop-color="#2d8ed6" stop-opacity=".22"/></linearGradient>
	<linearGradient id="${u}beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c2" stop-opacity="0"/><stop offset=".4" stop-color="#ffd76a"/><stop offset="1" stop-color="#ffb340" stop-opacity="0"/></linearGradient>`) + `
	<rect width="640" height="400" fill="url(#${u}bg)"/>
	${stars(23, 60, '#cfefff', 1.1)}
	<ellipse cx="300" cy="230" rx="280" ry="110" fill="#2ab0ff" opacity=".2" filter="url(#${u}b3)"/>
	${floor(u, '#9fdcff', 300, 400, 12)}
	<g>
		<rect x="30" y="120" width="96" height="70" rx="10" fill="url(#${u}dim)" transform="skewY(-6)"/>
		<rect x="150" y="70" width="130" height="62" rx="10" fill="url(#${u}dim)" transform="skewY(-6)"/>
		<rect x="160" y="230" width="80" height="54" rx="10" fill="url(#${u}dim)" transform="skewY(-6)"/>
		<rect x="470" y="150" width="120" height="70" rx="10" fill="url(#${u}dim)" transform="skewY(-6)"/>
		<rect x="360" y="250" width="100" height="58" rx="10" fill="url(#${u}dim)" transform="skewY(-6)"/>
		<rect x="500" y="260" width="66" height="80" rx="10" fill="url(#${u}dim)" transform="skewY(-6)"/>
		<rect x="286" y="122" width="170" height="108" rx="12" fill="#1b9be0" opacity=".6" filter="url(#${u}b2)" transform="skewY(-6)"/>
		<rect x="296" y="118" width="160" height="104" rx="12" fill="url(#${u}slab)" transform="skewY(-6)"/>
		<g fill="#062033" transform="skewY(-6)"><rect x="314" y="140" width="92" height="9" rx="4.5" opacity=".6"/><rect x="314" y="160" width="126" height="7" rx="3.5" opacity=".4"/><rect x="314" y="196" width="52" height="12" rx="6" opacity=".5"/></g>
	</g>
	<rect x="286" y="20" width="20" height="340" fill="url(#${u}beam)" filter="url(#${u}b1)" opacity=".9"/>
	<rect x="294" y="30" width="4" height="330" fill="#fff3c4"/>
	<circle cx="296" cy="112" r="26" fill="#ffd76a" opacity=".55" filter="url(#${u}b2)"/><circle cx="296" cy="112" r="8" fill="#fff8e1"/>
	<g fill="#cfefff" opacity=".8">${[60, 110, 160, 210, 260, 310, 360, 410, 460, 510, 560, 610].map(x => `<rect x="${x - 1}" y="348" width="2" height="9" rx="1"/>`).join('')}</g>
	<rect x="30" y="358" width="590" height="2" rx="1" fill="#cfefff" opacity=".6"/>
	${vignette(u)}</svg>`;

	/* Scheduler — an availability wall lit like an arena board; two people meeting in the light */
	ART.scheduler = (u) => open(u, `
	<linearGradient id="${u}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#03211e"/><stop offset=".5" stop-color="#0a4a40"/><stop offset="1" stop-color="#02110f"/></linearGradient>
	<linearGradient id="${u}open" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8ffdf"/><stop offset="1" stop-color="#22c983"/></linearGradient>
	<linearGradient id="${u}p1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe29a"/><stop offset="1" stop-color="#ff7a3d"/></linearGradient>
	<linearGradient id="${u}p2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9beaff"/><stop offset="1" stop-color="#1f7fd6"/></linearGradient>
	<linearGradient id="${u}ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8ffdf" stop-opacity=".35"/><stop offset="1" stop-color="#b8ffdf" stop-opacity="0"/></linearGradient>`) + `
	<rect width="640" height="400" fill="url(#${u}bg)"/>
	${stars(37, 40, '#c8ffe9', 1)}
	<polygon points="100,0 -60,400 260,400" fill="url(#${u}ray)"/><polygon points="540,0 380,400 700,400" fill="url(#${u}ray)"/>
	<ellipse cx="250" cy="180" rx="260" ry="150" fill="#22c983" opacity=".16" filter="url(#${u}b3)"/>
	${(() => { let c = ''; const openSet = new Set(['1-2', '2-4', '3-1', '0-5', '1-6']); for (let r = 0; r < 5; r++) for (let col = 0; col < 8; col++) { const x = 30 + col * 64, y = 40 + r * 60, k = `${r}-${col}`; const fade = Math.max(0.15, 1 - col / 9); if (openSet.has(k)) c += `<rect x="${x - 4}" y="${y - 4}" width="62" height="54" rx="12" fill="#22c983" opacity=".55" filter="url(#${u}b2)"/><rect x="${x}" y="${y}" width="54" height="46" rx="10" fill="url(#${u}open)"/><path d="M${x + 16} ${y + 24} l 8 8 l 16 -17" fill="none" stroke="#04382a" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`; else c += `<rect x="${x}" y="${y}" width="54" height="46" rx="10" fill="#b8ffdf" opacity="${(0.09 * fade).toFixed(3)}" stroke="#b8ffdf" stroke-opacity="${(0.3 * fade).toFixed(3)}"/>`; } return c; })()}
	<path d="M 280 190 C 400 190, 440 270, 500 300" fill="none" stroke="#b8ffdf" stroke-width="3" stroke-dasharray="7 9" stroke-linecap="round" opacity=".9"/>
	<ellipse cx="530" cy="340" rx="120" ry="30" fill="#22c983" opacity=".35" filter="url(#${u}b3)"/>
	<circle cx="492" cy="296" r="46" fill="url(#${u}p1)"/><circle cx="492" cy="280" r="16" fill="#3a1d05" opacity=".35"/>
	<circle cx="560" cy="304" r="50" fill="url(#${u}p2)"/><circle cx="560" cy="286" r="17" fill="#062033" opacity=".35"/>
	<circle cx="560" cy="304" r="50" fill="none" stroke="#02110f" stroke-width="5"/>
	<circle cx="560" cy="304" r="50" fill="none" stroke="#9beaff" stroke-opacity=".6" stroke-width="1.5"/>
	${vignette(u)}</svg>`;

	/* StoryForge — a forge: sparks and molten beats being struck into order */
	ART.storyforge = (u) => open(u, `
	<linearGradient id="${u}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2c1006"/><stop offset=".55" stop-color="#150b10"/><stop offset="1" stop-color="#07090f"/></linearGradient>
	<linearGradient id="${u}em" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff0b0"/><stop offset=".45" stop-color="#ffb340"/><stop offset="1" stop-color="#ff5a2a"/></linearGradient>
	<linearGradient id="${u}heat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7a3d" stop-opacity="0"/><stop offset=".5" stop-color="#fff1c7"/><stop offset="1" stop-color="#ff7a3d" stop-opacity="0"/></linearGradient>
	<radialGradient id="${u}fire" cx=".5" cy="1" r=".9"><stop offset="0" stop-color="#ff7a3d" stop-opacity=".75"/><stop offset=".6" stop-color="#ff7a3d" stop-opacity=".12"/><stop offset="1" stop-color="#ff7a3d" stop-opacity="0"/></radialGradient>`) + `
	<rect width="640" height="400" fill="url(#${u}bg)"/>
	<rect width="640" height="400" fill="url(#${u}fire)"/>
	${stars(57, 90, '#ffb340', 1.6)}
	<ellipse cx="420" cy="330" rx="280" ry="70" fill="#ff7a3d" opacity=".45" filter="url(#${u}b3)"/>
	<g fill="#ffd76a">${[[60, 80, 8, .7], [110, 160, 5, .6], [70, 240, 10, .45], [150, 60, 6, .7], [160, 300, 7, .55], [200, 130, 4, .8], [120, 330, 5, .5], [220, 250, 6, .6], [40, 180, 4, .6], [180, 200, 9, .35], [240, 60, 5, .6], [260, 330, 4, .7]].map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}"/><circle cx="${x}" cy="${y}" r="${r * 2.6}" opacity="${o * 0.35}" filter="url(#${u}b1)"/>`).join('')}
		${[[90, 130, 22], [150, 258, -30], [210, 190, 50], [70, 296, 12], [245, 140, -18]].map(([x, y, a]) => `<rect x="${x}" y="${y}" width="30" height="9" rx="3.5" opacity=".6" transform="rotate(${a} ${x + 15} ${y + 4})"/>`).join('')}</g>
	<path d="M 120 210 C 230 210, 260 150, 330 152 M 150 250 C 240 250, 270 210, 330 208 M 100 150 C 220 160, 260 260, 330 262" fill="none" stroke="#ffb340" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="2 7" stroke-linecap="round"/>
	<g>
		<rect x="330" y="118" width="268" height="60" rx="13" fill="#ff7a3d" opacity=".6" filter="url(#${u}b2)"/>
		<rect x="336" y="122" width="256" height="52" rx="12" fill="url(#${u}em)"/>
		<rect x="336" y="184" width="206" height="52" rx="12" fill="url(#${u}em)" opacity=".88"/>
		<rect x="336" y="246" width="232" height="52" rx="12" fill="url(#${u}em)" opacity=".74"/>
		<g fill="#2a140b" opacity=".55"><rect x="356" y="143" width="130" height="9" rx="4.5"/><rect x="356" y="205" width="96" height="9" rx="4.5"/><rect x="356" y="267" width="112" height="9" rx="4.5"/></g>
		<rect x="322" y="114" width="6" height="190" rx="3" fill="#fff1c7"/>
		<rect x="318" y="110" width="14" height="198" rx="7" fill="#ffd76a" opacity=".6" filter="url(#${u}b1)"/>
	</g>
	<rect x="200" y="322" width="400" height="3" fill="url(#${u}heat)"/>
	<rect x="200" y="320" width="400" height="7" fill="url(#${u}heat)" filter="url(#${u}b1)" opacity=".9"/>
	${vignette(u)}</svg>`;

	/* IV Prep On-Call — a lit interview stage: two figures, a voice line, an on-call pulse */
	ART.ivprep = (u) => open(u, `
	<linearGradient id="${u}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1150"/><stop offset=".6" stop-color="#0d0a2a"/><stop offset="1" stop-color="#05040f"/></linearGradient>
	<linearGradient id="${u}cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9d0ff" stop-opacity=".5"/><stop offset="1" stop-color="#d9d0ff" stop-opacity="0"/></linearGradient>
	<linearGradient id="${u}wave" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#39d6ff"/><stop offset="1" stop-color="#c7b8ff"/></linearGradient>
	<linearGradient id="${u}pa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9bcff"/><stop offset="1" stop-color="#4b3bd8"/></linearGradient>
	<linearGradient id="${u}pb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe29a"/><stop offset="1" stop-color="#ff6a3d"/></linearGradient>`) + `
	<rect width="640" height="400" fill="url(#${u}bg)"/>
	${stars(71, 50, '#d9d0ff', 1)}
	${rays(u, 320, -40, '#d9d0ff', 7, 9, 520, .06)}
	<polygon points="320,-20 110,400 530,400" fill="url(#${u}cone)"/>
	${floor(u, '#b8a9ff', 300, 400, 12)}
	<ellipse cx="320" cy="350" rx="300" ry="46" fill="#8a7dff" opacity=".45" filter="url(#${u}b3)"/>
	<g>
		<circle cx="150" cy="176" r="42" fill="url(#${u}pa)"/><path d="M 66 330 C 66 258, 108 234, 150 234 C 192 234, 234 258, 234 330 Z" fill="url(#${u}pa)"/>
		<path d="M 108 176 A 42 42 0 0 1 150 134" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>
		<circle cx="490" cy="170" r="42" fill="url(#${u}pb)"/><path d="M 406 330 C 406 252, 448 228, 490 228 C 532 228, 574 252, 574 330 Z" fill="url(#${u}pb)"/>
		<path d="M 532 170 A 42 42 0 0 0 490 128" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>
	</g>
	<circle cx="490" cy="170" r="62" fill="none" stroke="#ffd76a" stroke-opacity=".7" stroke-width="2.5"/>
	<circle cx="490" cy="170" r="84" fill="none" stroke="#ffd76a" stroke-opacity=".28" stroke-width="1.5"/>
	<polyline points="248,214 262,214 270,180 280,246 290,196 300,230 312,208 322,220 334,176 346,250 356,206 366,224 378,214 392,214" fill="none" stroke="url(#${u}wave)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
	<polyline points="248,214 262,214 270,180 280,246 290,196 300,230 312,208 322,220 334,176 346,250 356,206 366,224 378,214 392,214" fill="none" stroke="#39d6ff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".35" filter="url(#${u}b2)"/>
	<g transform="translate(566 56)"><circle r="28" fill="#0d0a2a" stroke="#d9d0ff" stroke-opacity=".6" stroke-width="2"/><path d="M0 0 L0 -19 M0 0 L13 6" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M -20 -20 A 28 28 0 0 1 22 -17" fill="none" stroke="#ffd76a" stroke-width="3.5" stroke-linecap="round"/></g>
	${vignette(u)}</svg>`;

	/* RISE — nebula program landscape, lit targets, a comet of a rising line */
	ART.rise = (u) => open(u, `
	<linearGradient id="${u}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#071a45"/><stop offset=".55" stop-color="#0a2c66"/><stop offset="1" stop-color="#030b1c"/></linearGradient>
	<linearGradient id="${u}rise" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#39d6ff" stop-opacity="0"/><stop offset=".55" stop-color="#39d6ff"/><stop offset="1" stop-color="#fff1c7"/></linearGradient>`) + `
	<rect width="640" height="400" fill="url(#${u}bg)"/>
	<ellipse cx="200" cy="120" rx="240" ry="120" fill="#6b4dff" opacity=".28" filter="url(#${u}b3)"/>
	<ellipse cx="480" cy="230" rx="240" ry="130" fill="#2a8fd8" opacity=".3" filter="url(#${u}b3)"/>
	${stars(91, 120, '#dbe9ff', 1.3)}
	${(() => { const P = [[60, 300], [120, 240], [180, 320], [150, 150], [230, 200], [290, 120], [330, 260], [380, 180], [420, 90], [470, 220], [520, 140], [560, 60], [590, 250], [270, 350], [460, 330], [560, 330], [90, 80], [350, 40]]; const E = [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [4, 6], [5, 7], [7, 8], [7, 9], [9, 10], [10, 11], [10, 12], [6, 13], [9, 14], [14, 15], [3, 16], [5, 17], [8, 11], [6, 9]]; const lit = new Set([5, 8, 10, 11]); return `<g stroke="#9fc4ff" stroke-opacity=".32" stroke-width="1.3">${E.map(([a, b]) => `<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}"/>`).join('')}</g>` + P.map(([x, y], i) => lit.has(i) ? `<circle cx="${x}" cy="${y}" r="26" fill="#39d6ff" opacity=".5" filter="url(#${u}b2)"/><circle cx="${x}" cy="${y}" r="8" fill="#f0fbff"/><circle cx="${x}" cy="${y}" r="15" fill="none" stroke="#39d6ff" stroke-opacity=".9" stroke-width="2"/>` : `<circle cx="${x}" cy="${y}" r="4.5" fill="#bcd6ff" opacity=".85"/>`).join(''); })()}
	<path d="M 40 350 C 220 330, 330 270, 470 190 S 560 110, 600 70" fill="none" stroke="#39d6ff" stroke-width="14" stroke-linecap="round" opacity=".3" filter="url(#${u}b2)"/>
	<path d="M 40 350 C 220 330, 330 270, 470 190 S 560 110, 600 70" fill="none" stroke="url(#${u}rise)" stroke-width="4.5" stroke-linecap="round"/>
	<circle cx="600" cy="70" r="22" fill="#fff1c7" opacity=".6" filter="url(#${u}b2)"/><circle cx="600" cy="70" r="7" fill="#fff8e1"/>
	<path d="M 574 64 L 600 70 L 592 95" fill="none" stroke="#ffd76a" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
	${vignette(u)}</svg>`;

	/* RankList IQ — a golden podium stack resolving from scattered options, lit from above */
	ART.ranklist = (u) => open(u, `
	<linearGradient id="${u}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d2606"/><stop offset=".5" stop-color="#1c1308"/><stop offset="1" stop-color="#0a0704"/></linearGradient>
	<linearGradient id="${u}gd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff1c7"/><stop offset=".5" stop-color="#ffd76a"/><stop offset="1" stop-color="#ffb340"/></linearGradient>`) + `
	<rect width="640" height="400" fill="url(#${u}bg)"/>
	${stars(113, 60, '#ffe29a', 1.2)}
	${rays(u, 480, -60, '#ffd76a', 6, 12, 520, .07)}
	<ellipse cx="480" cy="210" rx="220" ry="170" fill="#ffb340" opacity=".2" filter="url(#${u}b3)"/>
	${floor(u, '#ffd76a', 320, 400, 12)}
	<g fill="none" stroke="#ffd76a" stroke-opacity=".6" stroke-width="2" stroke-dasharray="6 7">
		<rect x="60" y="70" width="150" height="34" rx="9" transform="rotate(-6 135 87)"/><rect x="40" y="150" width="120" height="34" rx="9" transform="rotate(4 100 167)"/><rect x="90" y="222" width="170" height="34" rx="9" transform="rotate(-3 175 239)"/><rect x="50" y="300" width="100" height="34" rx="9" transform="rotate(7 100 317)"/>
	</g>
	<g fill="none" stroke="#ffb340" stroke-opacity=".55" stroke-width="1.8" stroke-linecap="round">
		<path d="M 215 88 C 290 88, 300 110, 360 110"/><path d="M 165 168 C 280 168, 280 178, 360 178"/><path d="M 262 240 C 300 240, 310 246, 360 246"/><path d="M 152 318 C 260 318, 300 314, 360 314"/>
	</g>
	<g>
		<rect x="360" y="82" width="242" height="58" rx="12" fill="#ffb340" opacity=".65" filter="url(#${u}b2)"/>
		<rect x="366" y="88" width="230" height="46" rx="10" fill="url(#${u}gd)"/>
		<rect x="366" y="156" width="190" height="46" rx="10" fill="url(#${u}gd)" opacity=".82"/>
		<rect x="366" y="224" width="150" height="46" rx="10" fill="url(#${u}gd)" opacity=".64"/>
		<rect x="366" y="292" width="110" height="46" rx="10" fill="url(#${u}gd)" opacity=".46"/>
		<g font-family="Rajdhani, Archivo, system-ui, sans-serif" font-weight="700" font-size="27" fill="#2a1a05"><text x="386" y="121">1</text><text x="386" y="189">2</text><text x="386" y="257">3</text><text x="386" y="325">4</text></g>
		<g fill="#2a1a05" opacity=".5"><rect x="412" y="106" width="120" height="8" rx="4"/><rect x="412" y="174" width="90" height="8" rx="4"/><rect x="412" y="242" width="70" height="8" rx="4"/><rect x="412" y="310" width="40" height="8" rx="4"/></g>
		<rect x="366" y="88" width="230" height="46" rx="10" fill="none" stroke="#fff8e1" stroke-opacity=".9" stroke-width="2"/>
	</g>
	${vignette(u)}</svg>`;

	/* LOR Builder — evidence streaming into a lit, signed, sealed letter */
	ART.lor = (u) => open(u, `
	<linearGradient id="${u}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4d0f30"/><stop offset=".55" stop-color="#22101d"/><stop offset="1" stop-color="#0b070d"/></linearGradient>
	<linearGradient id="${u}pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#eee0c8"/></linearGradient>
	<linearGradient id="${u}seal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe29a"/><stop offset="1" stop-color="#d87a1e"/></linearGradient>
	<linearGradient id="${u}ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd0e0" stop-opacity=".35"/><stop offset="1" stop-color="#ffd0e0" stop-opacity="0"/></linearGradient>`) + `
	<rect width="640" height="400" fill="url(#${u}bg)"/>
	${stars(131, 50, '#ffd0e0', 1)}
	<polygon points="455,-20 300,400 610,400" fill="url(#${u}ray)"/>
	<ellipse cx="450" cy="230" rx="210" ry="170" fill="#ff5a8a" opacity=".22" filter="url(#${u}b3)"/>
	<g fill="#ff9dbb">
		<rect x="44" y="96" width="92" height="26" rx="8" opacity=".6"/><rect x="70" y="150" width="120" height="26" rx="8" opacity=".75"/><rect x="40" y="204" width="80" height="26" rx="8" opacity=".55"/><rect x="88" y="258" width="110" height="26" rx="8" opacity=".7"/><rect x="50" y="312" width="96" height="26" rx="8" opacity=".5"/>
		<g fill="#4a1330"><circle cx="58" cy="109" r="4"/><circle cx="84" cy="163" r="4"/><circle cx="54" cy="217" r="4"/><circle cx="102" cy="271" r="4"/><circle cx="64" cy="325" r="4"/></g>
	</g>
	<path d="M 140 110 C 250 110, 250 200, 330 200 M 194 164 C 260 164, 270 200, 330 200 M 124 218 C 250 218, 260 204, 330 204 M 202 272 C 260 272, 270 212, 330 210 M 150 326 C 250 326, 270 220, 330 214" fill="none" stroke="#ff9dbb" stroke-opacity=".6" stroke-width="1.8" stroke-dasharray="3 7" stroke-linecap="round"/>
	<rect x="340" y="46" width="250" height="320" rx="12" fill="#ff5a8a" opacity=".35" filter="url(#${u}b2)" transform="rotate(-3 465 206)"/>
	<rect x="352" y="60" width="230" height="300" rx="10" fill="#e0cdb8" opacity=".6" transform="rotate(6 467 210)"/>
	<rect x="340" y="56" width="230" height="300" rx="10" fill="url(#${u}pg)" transform="rotate(-3 455 206)"/>
	<g transform="rotate(-3 455 206)" fill="#3c2536">
		<rect x="368" y="96" width="120" height="10" rx="5" opacity=".9"/>
		<rect x="368" y="126" width="174" height="6" rx="3" opacity=".35"/><rect x="368" y="142" width="160" height="6" rx="3" opacity=".35"/><rect x="368" y="158" width="170" height="6" rx="3" opacity=".35"/><rect x="368" y="186" width="150" height="6" rx="3" opacity=".35"/><rect x="368" y="202" width="172" height="6" rx="3" opacity=".35"/><rect x="368" y="218" width="120" height="6" rx="3" opacity=".35"/>
		<path d="M 372 300 C 390 270, 400 310, 418 288 C 430 272, 436 304, 452 290 C 464 280, 470 300, 486 292" fill="none" stroke="#3c2536" stroke-width="2.8" stroke-linecap="round" opacity=".85"/>
		<rect x="368" y="318" width="90" height="4" rx="2" opacity=".45"/>
	</g>
	<circle cx="534" cy="318" r="40" fill="#ffb340" opacity=".55" filter="url(#${u}b2)"/>
	<circle cx="534" cy="318" r="30" fill="url(#${u}seal)"/><circle cx="534" cy="318" r="30" fill="none" stroke="#fff3c4" stroke-opacity=".8" stroke-width="2" stroke-dasharray="4 3"/>
	<path d="M 521 318 l 9 9 l 17 -19" fill="none" stroke="#4a1330" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
	${vignette(u)}</svg>`;

	window.MMED_DASH_ART = ART;
})();
