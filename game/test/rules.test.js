// Regeltests. Aufruf: node game/test/rules.test.js
const assert = require('assert');
require('../js/data.js');
require('../js/missions.js');
require('../js/rules.js');
const AW = globalThis.AW, R = AW.rules;

// Testkarte: Zeilenstrings, Einheiten [Typ, Besitzer, x, y]
function game(map, units, co = ['mira', 'varek']) {
  return R.newGame({ map, units, co, funds: [0, 0], objective: { type: 'rout' } });
}
const cells = (s, u) => R.reachable(s, u).map((r) => `${r.x},${r.y}`);
const costAt = (s, u, x, y) => (R.reachable(s, u).find((r) => r.x === x && r.y === y) || {}).cost;

// Kosten Wald/Gebirge je Bewegungsart
{
  const s = game(['.T^..', '.A.B.'], [['inf', 0, 0, 0], ['tank', 0, 0, 1]]);
  const inf = R.unitAt(s, 0, 0), tank = R.unitAt(s, 0, 1);
  assert.strictEqual(costAt(s, inf, 1, 0), 1, 'Infanterie Wald 1');
  assert.strictEqual(costAt(s, inf, 2, 0), 3, 'Infanterie Gebirge 2 (+Wald 1)');
  assert.strictEqual(costAt(s, tank, 1, 0), 3, 'Panzer Wald 2 (+1 Anfahrt)');
  assert(!cells(s, tank).includes('2,0'), 'Panzer kann nicht ins Gebirge');
  const s2 = game(['.T^..', '.A.B.'], [['mech', 0, 0, 0], ['recon', 0, 0, 1]]);
  assert.strictEqual(costAt(s2, R.unitAt(s2, 0, 0), 2, 0), 2, 'Grenadier Gebirge 1 (+Wald 1)');
  assert.strictEqual(costAt(s2, R.unitAt(s2, 0, 1), 1, 0), 4, 'Späher Ebene->Wald: Wald 3 + Ebene 1');
}

// Blockade durch Gegner, Durchzug durch eigene
{
  const s = game(['.....', 'A...B'], [['inf', 0, 0, 0], ['inf', 1, 1, 0], ['inf', 0, 0, 1]]);
  const inf = R.unitAt(s, 0, 0);
  assert(!cells(s, inf).includes('1,0'), 'Gegnerfeld nicht betretbar');
  assert(cells(s, inf).includes('2,1'), 'Umweg um Gegner möglich');
  assert.strictEqual(costAt(s, inf, 2, 1), 3, 'Umweg kostet 3');
  const s2 = game(['.....', 'A...B'], [['inf', 0, 0, 0], ['inf', 0, 1, 0]]);
  const inf2 = R.unitAt(s2, 0, 0);
  assert(cells(s2, inf2).includes('2,0'), 'Durchzug durch eigene');
  assert(!cells(s2, inf2).includes('1,0'), 'Nicht auf eigener Einheit stehen bleiben');
  assert(cells(s2, inf2).includes('0,0'), 'Startfeld bleibt');
}

// Indirekte feuern nicht nach Bewegung, Mindestreichweite
{
  const s = game(['.......', 'A.....B'], [['art', 0, 0, 0], ['inf', 1, 2, 0], ['inf', 1, 1, 0]]);
  const art = R.unitAt(s, 0, 0);
  assert.deepStrictEqual(R.attackTargets(s, art, 0, 0, false).map((u) => u.x), [2], 'Artillerie trifft nur Distanz 2-3');
  assert.deepStrictEqual(R.attackTargets(s, art, 0, 0, true), [], 'nach Bewegung kein Angriff');
}

// Formel: Panzer 10 HP greift Infanterie 10 HP auf Wald an = 60
{
  const s = game(['.T..', 'A..B'], [['tank', 0, 0, 0], ['inf', 1, 1, 0]]);
  const tank = R.unitAt(s, 0, 0), inf = R.unitAt(s, 1, 0);
  assert.strictEqual(R.damage(s, tank, inf, 0, 0), 60);
  assert.deepStrictEqual(R.previewAttack(s, tank.id, 0, 0, inf.id), { dmg: 60, counter: R.damage(s, { ...inf, hp: 40 }, tank, 1, 0) });
  assert.strictEqual(inf.hp, 100, 'Vorschau ändert nichts');
}

// Gegenangriff mit reduzierten HP, CO-Bonus (Varek +15 % direkte Bodeneinheiten)
{
  const s = game(['....', 'A..B'], [['tank', 0, 0, 0], ['tank', 1, 1, 0]]);
  const a = R.unitAt(s, 0, 0), d = R.unitAt(s, 1, 0);
  // Mira: 49 Schaden -> Ziel 51 HP (Anzeige 6); Varek schlägt mit +15 % zurück
  const pv = R.previewAttack(s, a.id, 0, 0, d.id);
  assert.strictEqual(pv.dmg, Math.floor(55 * 100 * 10 * 90 / 100000));
  assert.strictEqual(pv.counter, Math.floor(55 * 115 * 6 * 90 / 100000));
  R.apply(s, { type: 'move', id: a.id, x: 0, y: 0, then: { attack: d.id } });
  assert.strictEqual(d.hp, 100 - pv.dmg);
  assert.strictEqual(a.hp, 100 - pv.counter);
  assert(a.acted);
  assert(s.players[0].charge > 0 && s.players[1].charge > 0, 'Ladung aufgebaut');
}

// Tod entfernt Einheit, kein Gegenangriff; Lufteinheit ohne Geländeschutz
{
  const s = game(['....', 'A..B'], [['heavy', 0, 0, 0], ['inf', 1, 1, 0]]);
  const h = R.unitAt(s, 0, 0), i = R.unitAt(s, 1, 0);
  i.hp = 10;
  R.apply(s, { type: 'move', id: h.id, x: 0, y: 0, then: { attack: i.id } });
  assert.strictEqual(R.unitAt(s, 1, 0), null);
  assert.strictEqual(h.hp, 100);
  const s2 = game(['.TT.', 'A..B'], [['fighter', 0, 0, 0], ['heli', 1, 1, 0]]);
  assert.strictEqual(R.damage(s2, R.unitAt(s2, 0, 0), R.unitAt(s2, 1, 0), 0, 0), 100);
}

// Ungültige Aktionen
{
  const s = game(['.....', 'A...B'], [['inf', 0, 0, 0], ['inf', 1, 4, 0]]);
  assert.throws(() => R.apply(s, { type: 'move', id: 2, x: 3, y: 0 }), 'fremde Einheit');
  assert.throws(() => R.apply(s, { type: 'move', id: 1, x: 4, y: 0 }), 'unerreichbar');
}

console.log('rules.test.js OK');
