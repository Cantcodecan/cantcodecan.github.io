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
    // Diagonal-Bits (nur Fluss): Ecke füllen -> zusammenhängende Fläche
    if (m & 16) s += `<rect x="24" y="0" width="24" height="24" fill="${col}"/>`;
    if (m & 32) s += `<rect x="24" y="24" width="24" height="24" fill="${col}"/>`;
    if (m & 64) s += `<rect x="0" y="24" width="24" height="24" fill="${col}"/>`;
    if (m & 128) s += `<rect x="0" y="0" width="24" height="24" fill="${col}"/>`;
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
          return ground(BASE.plain, x, y) + band(mask, 18, '#5aa7e0') + ((mask || 0) > 15 ? '' : band(mask, 6, '#a8dcfa'));
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
    unit(type, owner) {
      const t = team(owner);
      const S = `stroke="${OUT}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
      const MET = '#5d6b78', METL = '#8a99a8', SKIN = '#f1c9a5', GLASS = '#bfe6ff';
      const wheel = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${OUT}"/><circle cx="${cx}" cy="${cy}" r="${r / 2}" fill="${METL}"/>`;
      const track = (x, y, w, h, n) => {
        let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${t.dark}" ${S}/>`;
        for (let i = 0; i < n; i++) s += `<circle cx="${x + h / 2 + i * ((w - h) / (n - 1))}" cy="${y + h / 2}" r="${h / 2 - 2}" fill="${METL}"/>`;
        return s;
      };
      const soldier = (x, y0, dark) => {
        const c = dark ? t.dark : t.color;
        return `<g ${S}><path d="M${x - 5} ${y0 + 42}v-9h4.5v9zM${x + 0.5} ${y0 + 42}v-9h4.5v9z" fill="${MET}"/>` +
          `<rect x="${x - 6}" y="${y0 + 24}" width="12" height="11" rx="3" fill="${c}"/>` +
          `<path d="M${x - 6} ${y0 + 32}h12" stroke="${OUT}" stroke-width="1.5"/>` +
          `<circle cx="${x + 1}" cy="${y0 + 18}" r="6.5" fill="${SKIN}"/><circle cx="${x + 4}" cy="${y0 + 18.5}" r="1.3" fill="${OUT}" stroke="none"/>` +
          `<path d="M${x - 5.5} ${y0 + 14.5}a6.5 4.5 0 0 1 13 0z" fill="${c}"/><path d="M${x - 6.5} ${y0 + 14.5}h15" stroke-width="2"/>` +
          `<path d="M${x + 2} ${y0 + 29}L${x + 14} ${y0 + 22}" stroke="${MET}" stroke-width="3.5"/>` +
          `<path d="M${x + 1} ${y0 + 28}l3 -1" stroke="${SKIN}" stroke-width="3"/></g>`;
      };
      let b = '';
      let sh = `<ellipse cx="24" cy="43" rx="16" ry="3" fill="#000" opacity=".25"/>`;
      switch (type) {
        case 'inf':
          b = soldier(15, -2, true) + soldier(29, 0, false);
          break;
        case 'mech':
          b = `<g ${S}><rect x="5" y="22" width="9" height="14" rx="3" fill="${t.dark}"/>` +
            `<path d="M12 42v-8h5v8zM19 42v-8h5v8z" fill="${MET}"/>` +
            `<rect x="10" y="25" width="18" height="11" rx="4" fill="${t.color}"/>` +
            `<circle cx="20" cy="15.5" r="7.5" fill="${SKIN}"/><circle cx="23.5" cy="16.5" r="1.4" fill="${OUT}" stroke="none"/>` +
            `<path d="M12.5 12a7.5 5 0 0 1 15 0z" fill="${t.color}"/><path d="M11.5 12h17" stroke-width="2"/>` +
            `<rect x="9" y="25" width="34" height="6" rx="2.5" transform="rotate(-12 24 28)" fill="${MET}"/>` +
            `<path d="M41 18.5l7-1-2 7z" fill="${t.color}"/>` +
            `<path d="M20 31l8-3" stroke="${SKIN}" stroke-width="3.5"/></g>`;
          break;
        case 'recon':
          b = `<g ${S}><path d="M6 35v-8l8-2 5-7h12l4 8 7 2v7z" fill="${t.color}"/><path d="M19 18h12l3 7H16z" fill="${GLASS}"/>` +
            `<path d="M24 25V12h8" fill="none" stroke="${MET}" stroke-width="3"/></g>` + wheel(14, 36, 6) + wheel(36, 36, 6);
          break;
        case 'tank':
          b = track(6, 32, 36, 10, 4) +
            `<g ${S}><rect x="9" y="25" width="30" height="9" rx="2" fill="${t.color}"/><ellipse cx="22" cy="23" rx="10" ry="6.5" fill="${t.color}"/>` +
            `<path d="M20 18a8 5 0 0 1 8 0" fill="none" stroke="${t.light}" stroke-width="2"/>` +
            `<rect x="28" y="20.5" width="18" height="4" rx="1" fill="${MET}"/></g>`;
          break;
        case 'heavy':
          b = `<g ${S}><rect x="4" y="29" width="40" height="13" rx="6" fill="${t.dark}"/></g>` +
            [11, 18, 25, 32, 38].map((x) => `<circle cx="${x}" cy="36" r="3" fill="${METL}"/>`).join('') +
            `<g ${S}><rect x="6" y="21" width="36" height="12" rx="2" fill="${t.color}"/><path d="M6 33h36v4H6z" fill="${t.dark}"/>` +
            `<path d="M12 21l3-10h16l5 10z" fill="${t.color}"/><path d="M15 11h16l2 4H14z" fill="${t.light}"/>` +
            `<rect x="32" y="13" width="15" height="5.5" rx="1" fill="${MET}"/><rect x="43" y="11.5" width="4" height="8.5" fill="${METL}"/></g>`;
          break;
        case 'art':
          b = track(5, 32, 32, 10, 4) +
            `<g ${S}><rect x="8" y="25" width="26" height="9" rx="2" fill="${t.color}"/><rect x="12" y="17" width="12" height="9" fill="${t.dark}"/>` +
            `<g transform="rotate(-45 22 22)"><rect x="19" y="18" width="24" height="7" rx="2" fill="${MET}"/><rect x="40" y="16.5" width="5" height="10" fill="${METL}"/></g></g>`;
          break;
        case 'rocket':
          b = `<g ${S}><rect x="3" y="28" width="42" height="8" rx="2" fill="${t.color}"/><rect x="32" y="21" width="12" height="8" fill="${t.dark}"/>` +
            `<g transform="rotate(-35 18 26)"><rect x="8" y="19" width="32" height="10" rx="2" fill="${MET}"/>` +
            [21, 24, 27].map((y) => `<rect x="9" y="${y - 3.5}" width="30" height="3" fill="#fff" stroke-width="1.2"/><path d="M39 ${y - 3.5}l5 1.5-5 1.5z" fill="${t.color}" stroke-width="1.2"/>`).join('') + `</g></g>` +
            wheel(10, 37, 4.5) + wheel(21, 37, 4.5) + wheel(32, 37, 4.5) + wheel(41, 37, 4.5);
          break;
        case 'aa':
          b = track(5, 32, 34, 10, 4) +
            `<g ${S}><rect x="8" y="25" width="28" height="9" rx="2" fill="${t.color}"/><rect x="12" y="19" width="14" height="7" fill="${t.dark}"/>` +
            `<g transform="rotate(-62 20 20)"><rect x="18" y="14" width="22" height="3.5" fill="${MET}"/><rect x="18" y="19" width="22" height="3.5" fill="${MET}"/></g>` +
            `<path d="M32 25V18" stroke="${MET}"/><ellipse cx="33" cy="14" rx="7" ry="3.5" transform="rotate(-25 33 14)" fill="${METL}"/></g>`;
          break;
        case 'heli':
          sh = `<ellipse cx="24" cy="44" rx="12" ry="2.2" fill="#000" opacity=".25"/>`;
          b = `<g ${S}><path d="M3 18h12" stroke="${t.dark}" stroke-width="3"/><path d="M4 12v12" stroke="${MET}" stroke-width="2.5"/>` +
            `<path d="M10 22q0-9 14-9 11 0 14 10-3 9-15 9-13 0-13-10z" fill="${t.color}"/><path d="M26 15q9 0 12 8h-12z" fill="${GLASS}"/>` +
            `<path d="M10 22L2 20l1 6 8 0" fill="${t.dark}"/><path d="M24 13V9"/><ellipse cx="24" cy="8" rx="20" ry="2.2" fill="${METL}"/>` +
            `<path d="M14 37h22M20 31v6M30 31v6" fill="none"/><path d="M33 29h8" stroke="${MET}" stroke-width="3"/></g>`;
          break;
        case 'fighter':
          sh = `<ellipse cx="24" cy="44" rx="12" ry="2.2" fill="#000" opacity=".25"/>`;
          b = `<path d="M1 26l7-3v6z" fill="#ffb547" stroke="${OUT}" stroke-width="1.5"/>` +
            `<g ${S}><path d="M6 21L2 11h6l10 8z" fill="${t.dark}"/><path d="M6 26h26l13 3-13 4H6z" fill="${t.color}"/>` +
            `<path d="M12 26l14-3 8 3z" fill="${t.light}"/><path d="M14 31L24 41h6L28 33z" fill="${t.dark}"/><path d="M30 26q5-5 11-1l-3 4z" fill="${GLASS}"/></g>`;
          break;
        case 'bomber':
          sh = `<ellipse cx="24" cy="44" rx="16" ry="2.4" fill="#000" opacity=".25"/>`;
          b = `<g ${S}><path d="M4 22l-3-9h6l5 9z" fill="${t.dark}"/><rect x="4" y="21" width="38" height="11" rx="5" fill="${t.color}"/>` +
            `<path d="M36 22q6 0 7 5l-6 1z" fill="${GLASS}"/><path d="M13 28L22 39h10L26 28z" fill="${t.dark}"/>` +
            `<rect x="16" y="36" width="10" height="6" rx="2" fill="${MET}"/><rect x="30" y="34" width="9" height="6" rx="2" fill="${MET}"/>` +
            `<rect x="14" y="31" width="14" height="3.5" fill="#2b3340" stroke-width="1.2"/></g>`;
          break;
        default:
          b = `<circle cx="24" cy="26" r="12" fill="${t.color}" ${S}/>`;
      }
      const inner = sh + b;
      return owner === 1 ? `<g transform="translate(48 0) scale(-1 1)">${inner}</g>` : inner;
    },
    portrait(coId) {
      const S = `stroke="${OUT}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
      const SKIN = '#f1c9a5';
      const c = AW.COMMANDERS[coId];
      const f = AW.FACTIONS[c ? c.faction : 0];
      const bg = `<rect width="64" height="64" fill="${f.light}"/>`;
      const shoulders = (col, extra) => `<path d="M6 64q2-18 26-18t26 18z" fill="${col}" ${S}/>` + (extra || '');
      const face = `<path d="M22 28q0 16 10 16t10-16q0-6-10-6t-10 6z" fill="${SKIN}" ${S}/>`;
      const eyes = (y) => `<circle cx="27" cy="${y}" r="1.6" fill="${OUT}"/><circle cx="37" cy="${y}" r="1.6" fill="${OUT}"/>`;
      switch (coId) {
        case 'mira':
          return bg + shoulders(f.color, `<path d="M26 47l6 6 6-6" fill="${f.light}" ${S}/>`) + face +
            `<path d="M20 30q-3-16 12-16t12 16q-3-8-12-9-8 1-12 9z" fill="#a8532b" ${S}/><path d="M20 30q-2 6 0 10" fill="none" stroke="#a8532b" stroke-width="4"/>` +
            `<rect x="23" y="17" width="18" height="5" rx="2.5" fill="#5d6b78" ${S}/><rect x="25" y="18" width="14" height="3" rx="1.5" fill="#bfe6ff"/>` +
            eyes(31) + `<path d="M26 28l4 1M38 28l-4 1" stroke="${OUT}" stroke-width="1.6"/><path d="M29 38q3 1.5 6 0" stroke="${OUT}" stroke-width="1.6" fill="none"/>`;
        case 'tarek':
          return bg + shoulders(f.color, `<circle cx="20" cy="54" r="2.5" fill="#ffb547"/><circle cx="26" cy="57" r="2.5" fill="#fff"/><path d="M26 47l6 6 6-6" fill="${f.light}" ${S}/>`) + face +
            `<path d="M21 26q-1-8 11-8t11 8q-3-3-11-3t-11 3z" fill="#9aa4ae" ${S}/>` +
            `<path d="M19 24q0-12 13-12t13 12z" fill="${f.dark}" ${S}/><path d="M17 24h30v4H17z" fill="${f.dark}" ${S}/><circle cx="32" cy="19" r="2.5" fill="#ffb547"/>` +
            eyes(31) + `<path d="M24 29l5 1M40 29l-5 1" stroke="#9aa4ae" stroke-width="2"/><path d="M25 37q7-4 14 0-3 3-7 1.5-4 1.5-7-1.5z" fill="#9aa4ae" ${S}/>`;
        case 'varek':
          return bg + shoulders(f.color, `<rect x="6" y="48" width="12" height="5" fill="#ffb547" ${S}/><rect x="46" y="48" width="12" height="5" fill="#ffb547" ${S}/>`) +
            `<path d="M21 28q0 17 11 17t11-17q0-6-11-6t-11 6z" fill="${SKIN}" ${S}/>` +
            `<path d="M19 24q0-12 13-12t13 12z" fill="${f.dark}" ${S}/><path d="M17 24h30v4H17z" fill="${f.dark}" ${S}/>` +
            `<path d="M32 15l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="#ffb547"/>` +
            eyes(32) + `<path d="M23 30l6 2M41 30l-6 2" stroke="${OUT}" stroke-width="2.2"/><path d="M38 27l4 9" stroke="#b5483a" stroke-width="2"/>` +
            `<path d="M28 40h8" stroke="${OUT}" stroke-width="2"/>`;
        case 'sel':
          return bg + shoulders('#8a2b25', `<path d="M24 46l8 18 8-18" fill="#ece6d6" ${S}/><path d="M32 52v12" stroke="${OUT}" stroke-width="1.5"/>`) +
            `<path d="M17 36q-3-22 15-22t15 22v6H17z" fill="#1d2330" ${S}/>` + face +
            `<path d="M22 27q10-1 10-9 4 8 10 9-1-8-10-11-9 3-10 11z" fill="#1d2330" ${S}/>` +
            `<rect x="23" y="29" width="8" height="5.5" rx="2" fill="#bfe6ff" fill-opacity=".5" stroke="${OUT}" stroke-width="1.5"/><rect x="33" y="29" width="8" height="5.5" rx="2" fill="#bfe6ff" fill-opacity=".5" stroke="${OUT}" stroke-width="1.5"/>` +
            `<path d="M31 31h2" stroke="${OUT}" stroke-width="1.5"/><path d="M24.5 30.5l3-1" stroke="#fff" stroke-width="1.2"/><circle cx="27" cy="32" r="1.3" fill="${OUT}"/><circle cx="37" cy="32" r="1.3" fill="${OUT}"/>` +
            `<path d="M28 39q4 3 8 0" stroke="${OUT}" stroke-width="1.6" fill="none"/>`;
        default:
          return bg + shoulders(f.color) + face + eyes(31);
      }
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
