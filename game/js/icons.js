// Piktogramme als SVG-Strings. Stilregeln: docs/ART.md
(function (g) {
  const AW = (g.AW = g.AW || {});
  const OUT = '#1d2330';
  const NEUTRAL = { color: '#c9c2b2', dark: '#8d8676', light: '#ece6d6' };
  const team = (o) => (o === null || o === undefined ? NEUTRAL : AW.FACTIONS[o]);
  const BASE = { plain: '#9bd16f', road: '#9bd16f', forest: '#7fb957', mountain: '#9bd16f', river: '#9bd16f', sea: '#4a90c9' };

  const tufts = (x, y) => {
    const v = (x * 7 + y * 13) % 3;
    const p = [[[10, 14], [32, 34], [38, 12]], [[14, 36], [34, 18], [8, 24]], [[36, 38], [12, 12], [26, 28]]][v];
    return p.map(([a, b]) => `<path d="M${a} ${b}l2-5 2 5m1 0l2-4 2 4" stroke="#7fb957" stroke-width="1.5" fill="none"/>`).join('');
  };

  // Band von der Mitte zu jedem gesetzten Rand (Bits: oben 1, rechts 2, unten 4, links 8)
  const band = (mask, w, col) => {
    const m = mask || 0;
    let s = `<circle cx="24" cy="24" r="${w / 2}" fill="${col}"/>`;
    if (!m) s = `<rect x="${24 - w / 2}" y="${24 - w / 2}" width="${w}" height="${w}" rx="3" fill="${col}"/>`;
    if (m & 1) s += `<rect x="${24 - w / 2}" y="0" width="${w}" height="24" fill="${col}"/>`;
    if (m & 4) s += `<rect x="${24 - w / 2}" y="24" width="${w}" height="24" fill="${col}"/>`;
    if (m & 8) s += `<rect x="0" y="${24 - w / 2}" width="24" height="${w}" fill="${col}"/>`;
    if (m & 2) s += `<rect x="24" y="${24 - w / 2}" width="24" height="${w}" fill="${col}"/>`;
    return s;
  };
  const dashes = (mask, col) => {
    const m = mask || 0;
    const a = 'stroke-dasharray="4 4"';
    const seg = (d) => `<path d="${d}" stroke="${col}" stroke-width="1.5" fill="none" ${a}/>`;
    let s = '';
    if (m & 1) s += seg('M24 0V24');
    if (m & 4) s += seg('M24 24V48');
    if (m & 8) s += seg('M0 24H24');
    if (m & 2) s += seg('M24 24H48');
    return s;
  };

  const tree = (x, y, sc) =>
    `<g transform="translate(${x} ${y}) scale(${sc})"><rect x="-2" y="8" width="4" height="6" fill="#6b4a2b"/>` +
    `<path d="M0-14L-9 2H9z" fill="#3f7a31"/><path d="M0-14L9 2H0z" fill="#2f6325"/>` +
    `<path d="M0-6L-11 10H11z" fill="#3f7a31"/><path d="M0-6L11 10H0z" fill="#2f6325"/></g>`;
  const mount = (x, y, sc) =>
    `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M-16 14L0-16L16 14z" fill="#8d96a0"/>` +
    `<path d="M0-16L16 14H2z" fill="#6f7882"/><path d="M0-16L-5-6L0-8L4-5z" fill="#f4f7fa"/></g>`;

  const ground = (c, x, y) => `<rect width="48" height="48" fill="${c}"/>` + tufts(x, y);
  const win = (x, y) => `<rect x="${x}" y="${y}" width="4" height="4" fill="#5d6b78"/>`;

  const buildings = {
    city: (t) =>
      `<g stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round">` +
      `<rect x="6" y="22" width="16" height="18" fill="#ece6d6"/><path d="M3 23L14 11L25 23z" fill="${t.color}"/>` +
      `<rect x="24" y="16" width="18" height="24" fill="#ece6d6"/><path d="M21 17L33 5L45 17z" fill="${t.color}"/></g>` +
      win(10, 28) + win(15, 28) + win(10, 34) + win(29, 22) + win(35, 22) + win(29, 29) + win(35, 29) + win(29, 35) + win(35, 35),
    factory: (t) =>
      `<g stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round">` +
      `<rect x="32" y="8" width="6" height="16" fill="#8a99a8"/>` +
      `<rect x="5" y="22" width="38" height="18" fill="#ece6d6"/>` +
      `<path d="M5 22V14L16 22V14L27 22V14L38 22V14L43 17V22z" fill="${t.color}"/>` +
      `<rect x="16" y="29" width="12" height="11" fill="#2b3340"/></g>` +
      `<circle cx="34" cy="6" r="4" fill="#bdbdbd" opacity=".9"/><circle cx="39" cy="3" r="3" fill="#d7d7d7" opacity=".9"/>`,
    airport: (t) =>
      `<g stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round">` +
      `<rect x="3" y="28" width="42" height="12" fill="#8a99a8"/><rect x="32" y="12" width="8" height="16" fill="#ece6d6"/>` +
      `<rect x="30" y="8" width="12" height="6" fill="#bfe6ff"/></g>` +
      `<path d="M7 34h6M18 34h6M29 34h6" stroke="#fff" stroke-width="2"/>` +
      `<path d="M14 8V26" stroke="${OUT}" stroke-width="1.5"/><path d="M14 8h10l-3 4 3 4H14z" fill="${t.color}" stroke="${OUT}" stroke-width="1"/>`,
    hq: (t) => {
      const emblem = t === AW.FACTIONS[1]
        ? `<path d="M24 5l1.3 2.8 3 .4-2.2 2.1.6 3L24 11.8 21.3 13.3l.6-3-2.2-2.1 3-.4z" fill="#fff"/>`
        : `<path d="M19 9q2.5-3 5 0t5 0" stroke="#fff" stroke-width="1.8" fill="none"/><path d="M19 13q2.5-3 5 0t5 0" stroke="#fff" stroke-width="1.8" fill="none"/>`;
      return `<g stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round">` +
        `<rect x="6" y="18" width="10" height="22" fill="#ece6d6"/><rect x="32" y="18" width="10" height="22" fill="#ece6d6"/>` +
        `<rect x="14" y="26" width="20" height="14" fill="#d9d2c0"/>` +
        `<path d="M6 18v-3h3v2h2v-2h3v2h2v-3zM32 18v-3h3v2h2v-2h3v2h2v-3z" fill="#ece6d6"/>` +
        `<path d="M24 26V3" /><rect x="14" y="3" width="20" height="12" fill="${t.color}" /></g>` + emblem +
        `<rect x="21" y="31" width="6" height="9" fill="#2b3340"/>`;
    },
  };

  AW.icons = {
    terrain(terrain, owner, x, y, mask) {
      if (buildings[terrain]) return ground(BASE.plain, x, y) + buildings[terrain](team(owner));
      switch (terrain) {
        case 'road': {
          return ground(BASE.plain, x, y) + band(mask, 20, '#b8ad90') + band(mask, 16, '#d9cfb4') + dashes(mask, '#efe8d2');
        }
        case 'forest':
          return `<rect width="48" height="48" fill="${BASE.forest}"/>` + [[(x * 3) % 3 === 0 ? 14 : 12, 20, 1], [34, 18, 1], [24, 38, 1.1]].map(([a, b, s]) => tree(a, b, s)).join('');
        case 'mountain':
          return ground(BASE.plain, x, y) + ((x + y) % 2 ? mount(16, 32, 1) + mount(33, 36, .8) : mount(26, 30, 1.2));
        case 'river': {
          return ground(BASE.plain, x, y) + band(mask, 18, '#5aa7e0') + band(mask, 6, '#a8dcfa');
        }
        case 'sea': {
          const v = (x * 7 + y * 13) % 3;
          const w = [[10, 16], [14, 32]], w2 = [[22, 14], [8, 30]], w3 = [[6, 20], [20, 36]];
          return `<rect width="48" height="48" fill="${BASE.sea}"/>` +
            [[w, w2, w3][v]][0].map(([a, b]) => `<path d="M${a} ${b}q4-5 8 0t8 0" stroke="#8cc7ef" stroke-width="2" fill="none"/>`).join('');
        }
        default:
          return ground(BASE.plain, x, y);
      }
    },
    // Platzhalter: Kreis in Teamfarbe mit Kürzel (T04 ersetzt dies)
    unit(type, owner) {
      const t = team(owner);
      const k = (AW.UNITS[type] && AW.UNITS[type].name || type).slice(0, 2);
      return `<ellipse cx="24" cy="43" rx="16" ry="3" fill="#000" opacity=".25"/>` +
        `<circle cx="24" cy="26" r="15" fill="${t.color}" stroke="${OUT}" stroke-width="2"/>` +
        `<text x="24" y="31" text-anchor="middle" font-size="14" font-weight="700" fill="#fff" font-family="sans-serif">${k}</text>`;
    },
    // Platzhalter: Kreis mit Initialen (T04 ersetzt dies)
    portrait(coId) {
      const c = AW.COMMANDERS[coId];
      const t = AW.FACTIONS[c ? c.faction : 0];
      const ini = (c ? c.name : '?').split(' ').map((s) => s[0]).join('').slice(0, 2);
      return `<rect width="64" height="64" fill="${t.light}"/><circle cx="32" cy="32" r="26" fill="${t.color}" stroke="${OUT}" stroke-width="2"/>` +
        `<text x="32" y="40" text-anchor="middle" font-size="24" font-weight="700" fill="#fff" font-family="sans-serif">${ini}</text>`;
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
