// Prüft Daten und Karten auf Konsistenz. Aufruf: node game/test/data.test.js
const assert = require('assert');
require('../js/data.js');
require('../js/missions.js');
const AW = globalThis.AW;

for (const [a, row] of Object.entries(AW.DAMAGE)) {
  assert(AW.UNITS[a], `DAMAGE: unbekannter Angreifer ${a}`);
  for (const d of Object.keys(row)) assert(AW.UNITS[d], `DAMAGE ${a}: unbekanntes Ziel ${d}`);
}
for (const [id, u] of Object.entries(AW.UNITS)) {
  assert(AW.MOVE_COST[u.moveType], `${id}: unbekannte Bewegungsart`);
  assert(AW.DAMAGE[id], `${id}: fehlt in DAMAGE`);
}

for (const m of [...AW.MISSIONS, ...AW.SKIRMISH]) {
  const w = m.map[0].length;
  const hq = [0, 0];
  m.map.forEach((row, y) => {
    assert.strictEqual(row.length, w, `${m.id}: Zeile ${y} hat Länge ${row.length} statt ${w}`);
    for (const ch of row) {
      const t = AW.TILE_CHARS[ch];
      assert(t, `${m.id}: unbekanntes Zeichen '${ch}' in Zeile ${y}`);
      if (t[0] === 'hq') hq[t[1]]++;
    }
  });
  assert(hq[0] === 1 && hq[1] === 1, `${m.id}: braucht genau ein HQ je Seite`);
  const seen = new Set();
  for (const [type, owner, x, y] of m.units) {
    const key = `${x},${y}`;
    assert(!seen.has(key), `${m.id}: zwei Einheiten auf ${key}`);
    seen.add(key);
    const terrain = AW.TILE_CHARS[m.map[y][x]][0];
    assert(AW.MOVE_COST[AW.UNITS[type].moveType][terrain], `${m.id}: ${type} (${owner}) auf ${terrain} bei ${key} unpassierbar`);
  }
  (m.build || []).forEach(t => assert(AW.UNITS[t], `${m.id}: build enthält ${t}`));
  if (m.co) m.co.forEach(c => assert(AW.COMMANDERS[c], `${m.id}: CO ${c} fehlt`));
}
console.log('data.test.js: OK');
