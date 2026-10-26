// KI gegen KI. Aufruf: node game/test/selfplay.js levelA levelB games [startgeld]
// games = Partien je Karte, Seiten wechseln. Ausgabe: Siegquote von A, ms/Zug.
require('../js/data.js');
require('../js/missions.js');
require('../js/rules.js');
require('../js/ai.js');
const AW = globalThis.AW, R = AW.rules;

const [levelA = 'normal', levelB = 'easy', games = '10', fundsArg] = process.argv.slice(2);
const N = +games;

// Kampagnenkarten sind asymmetrisch. Fürs Messen: linke Hälfte (mit Azur-HQ) an der Mittelachse spiegeln, Besitzer tauschen,
// gleiche Startaufstellung und gleiches Startgeld für beide.
const SWAP = { '1': '2', '2': '1', F: 'G', G: 'F', P: 'Q', Q: 'P', A: 'B', B: 'A' };
function symmetric(m) {
  let rows = m.map, units = m.units;
  const w = rows[0].length, half = Math.floor(w / 2);
  if (!rows.some((r) => r.slice(0, half).includes('A'))) {
    rows = rows.map((r) => [...r].reverse().join(''));
    units = units.map(([t, o, x, y]) => [t, o, w - 1 - x, y]);
  }
  const map = rows.map((r) => {
    const left = r.slice(0, half), mid = w % 2 ? (SWAP[r[half]] ? '.' : r[half]) : '';
    return left + mid + [...left].reverse().map((c) => SWAP[c] || c).join('');
  });
  const seen = new Set(), out = [];
  for (const [t, o, x, y] of units.filter((u) => u[1] === 0)) {
    const lx = Math.min(x, w - 1 - x);
    if (lx >= half || seen.has(lx + ',' + y)) continue;
    seen.add(lx + ',' + y);
    out.push([t, 0, lx, y], [t, 1, w - 1 - lx, y]);
  }
  const f = fundsArg ? +fundsArg : Math.max(3000, ...(m.funds || [0]));
  return { ...m, map, units: out, funds: [f, f], co: ['mira', 'mira'], objective: { type: 'rout' } };
}
// m1: Panzer stehen 5 Felder auseinander, wer zuerst zieht, gewinnt den Erstschlag (jede Stufe ~50 %). Wird angezeigt, aber nicht gewertet.
const UNRATED = new Set(['m1']);
const maps = [...AW.MISSIONS, ...AW.SKIRMISH].map(symmetric);

function play(mapDef, aSide) {
  const levels = [null, null];
  levels[aSide] = levelA; levels[1 - aSide] = levelB;
  const s = R.newGame(mapDef, { co: mapDef.co, ai: levels, difficulty: 'normal' });
  let ms = 0, turns = 0;
  while (s.winner === null) {
    const t0 = Date.now();
    const plan = AW.ai.planTurn(s, levels[s.turn]);
    ms += Date.now() - t0; turns++;
    for (const a of plan) { if (a.type === 'build') builds[a.unit] = (builds[a.unit] || 0) + 1; R.apply(s, a); if (s.winner !== null) break; }
    if (turns > 400) throw new Error('Partie endet nicht: ' + mapDef.id);
  }
  return { winner: s.winner, ms, turns, days: s.day };
}

const builds = {};
let wins = 0, draws = 0, total = 0, ms = 0, turns = 0;
for (const m of maps) {
  let w = 0;
  const side = [0, 0];
  for (let i = 0; i < N; i++) {
    const aSide = i % 2, r = play(m, aSide);
    total++; ms += r.ms; turns += r.turns;
    if (r.winner === 0 || r.winner === 1) side[r.winner]++;
    if (r.winner === aSide) w++; else if (r.winner === 'draw') draws++;
  }
  console.log(`${m.id.padEnd(3)} ${levelA} gewinnt ${w}/${N}${UNRATED.has(m.id) ? ' (nicht gewertet)' : ''} · Seite 0: ${side[0]}, Seite 1: ${side[1]}`);
  if (UNRATED.has(m.id)) { total -= N; continue; }
  wins += w;
}
console.log(`${levelA} vs ${levelB}: ${(100 * wins / total).toFixed(0)} % (${wins}/${total}, ${draws} unentschieden), ${(ms / turns).toFixed(0)} ms/Zug`);
console.log('Gebaut: ' + Object.keys(AW.UNITS).map((t) => `${t} ${builds[t] || 0}`).join(', '));
