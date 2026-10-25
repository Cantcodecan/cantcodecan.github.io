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

// --- T02 ---
const game2 = (map, units, o = {}) => R.newGame({ map, units, co: o.co || ['mira', 'varek'], funds: o.funds || [0, 0], objective: o.objective || { type: 'rout' }, build: o.build }, o);
const act = (s, id, x, y, then) => R.apply(s, { type: 'move', id, x, y, then });

// Einnahme mit 10 HP in 2 Zügen, Reset bei Verlassen
{
  const s = game2(['A.c.B'], [['inf', 0, 2, 0], ['inf', 1, 4, 0], ['inf', 0, 0, 0]]);
  const inf = R.unitAt(s, 2, 0);
  act(s, inf.id, 2, 0, 'capture');
  assert.strictEqual(R.tileAt(s, 2, 0).cp, 10);
  R.apply(s, { type: 'end' }); R.apply(s, { type: 'end' });
  act(s, inf.id, 2, 0, 'capture');
  assert.strictEqual(R.tileAt(s, 2, 0).owner, 0, 'Stadt gehört Azur');
  assert.strictEqual(R.tileAt(s, 2, 0).cp, 20);
  const s2 = game2(['A.c.B'], [['inf', 0, 2, 0], ['inf', 1, 4, 0]]);
  const i2 = R.unitAt(s2, 2, 0);
  act(s2, i2.id, 2, 0, 'capture');
  R.apply(s2, { type: 'end' }); R.apply(s2, { type: 'end' });
  act(s2, i2.id, 3, 0, 'wait');
  assert.strictEqual(R.tileAt(s2, 2, 0).cp, 20, 'Reset beim Verlassen');
  const s3 = game2(['A.c.B'], [['tank', 0, 2, 0], ['inf', 1, 4, 0]]);
  assert.throws(() => act(s3, 1, 2, 0, 'capture'), 'Panzer kann nicht einnehmen');
}

// Einkommen (KI-Multiplikator nur für KI), Heilen mit Kosten
{
  const s = game2(['A1.2B'], [['inf', 0, 0, 0], ['inf', 1, 4, 0]], { ai: [null, 'brutal'], difficulty: 'brutal' });
  R.apply(s, { type: 'end' });
  assert.strictEqual(s.players[1].funds, 2200, 'KI: 2 Gebäude × 1000 × 1,1');
  R.apply(s, { type: 'end' });
  assert.strictEqual(s.players[0].funds, 2000, 'Mensch ohne Multiplikator');
  assert.strictEqual(s.day, 2);
  const h = game2(['A1.2B'], [['inf', 0, 1, 0], ['inf', 1, 4, 0]], { funds: [100, 0] });
  const u = R.unitAt(h, 1, 0); u.hp = 50;
  R.apply(h, { type: 'end' }); R.apply(h, { type: 'end' });
  assert.strictEqual(u.hp, 70, '+20 HP');
  assert.strictEqual(h.players[0].funds, 100 + 2000 - 200, 'Heilkosten 10 % × 2');
  const poor = game2(['A1.2B'], [['tank', 0, 1, 0], ['inf', 1, 4, 0]], { funds: [0, 0] });
  const t = R.unitAt(poor, 1, 0); t.hp = 50; poor.tiles[1].owner = null;
  R.apply(poor, { type: 'end' }); R.apply(poor, { type: 'end' });
  assert.strictEqual(t.hp, 50, 'Kein Heilen auf neutralem Feld');
}

// Bauen: nur freie eigene Fabrik, costMod, Auswahl, Geld
{
  const s = game2(['AFP2B'], [['inf', 0, 0, 0], ['inf', 1, 4, 0]], { funds: [30000, 0], build: ['inf', 'tank', 'fighter'] });
  assert.deepStrictEqual(R.buildOptions(s, 1, 0).map((o) => o.type), ['inf', 'tank']);
  assert.deepStrictEqual(R.buildOptions(s, 2, 0).map((o) => o.type), ['fighter']);
  assert.deepStrictEqual(R.buildOptions(s, 3, 0), [], 'fremde Stadt');
  R.apply(s, { type: 'build', x: 1, y: 0, unit: 'tank' });
  const nu = R.unitAt(s, 1, 0);
  assert(nu.acted, 'neue Einheit inaktiv');
  assert.strictEqual(s.players[0].funds, 30000 - AW.UNITS.tank.cost);
  assert.deepStrictEqual(R.buildOptions(s, 1, 0), [], 'besetzte Fabrik');
  assert.throws(() => R.apply(s, { type: 'build', x: 1, y: 0, unit: 'inf' }));
  assert.throws(() => R.apply(s, { type: 'build', x: 2, y: 0, unit: 'bomber' }), 'nicht in build-Liste');
  R.apply(s, { type: 'end' }); R.apply(s, { type: 'end' });
  assert(!nu.acted, 'am nächsten Tag aktiv');
  const sel = game2(['AFP2B'], [['inf', 0, 0, 0], ['inf', 1, 4, 0]], { co: ['mira', 'sel'], funds: [0, 30000] });
  R.apply(sel, { type: 'end' });
  sel.tiles[2].owner = 1;
  assert.strictEqual(R.buildOptions(sel, 2, 0).find((o) => o.type === 'fighter').cost, AW.UNITS.fighter.cost * 0.9);
  const poor = game2(['AFP2B'], [['inf', 0, 0, 0], ['inf', 1, 4, 0]], { funds: [500, 0] });
  assert.throws(() => R.apply(poor, { type: 'build', x: 1, y: 0, unit: 'inf' }), 'zu wenig Geld');
}

// HQ-Einnahme beendet das Spiel
{
  const e = game2(['A...B'], [['inf', 0, 3, 0], ['inf', 1, 0, 0]]);
  e.tiles[4].cp = 10;
  const i = R.unitAt(e, 3, 0); i.x = 4;
  act(e, i.id, 4, 0, 'capture');
  assert.strictEqual(e.winner, 0);
  assert(R.isOver(e));
  assert.throws(() => R.apply(e, { type: 'end' }), 'nach Ende keine Aktionen');
}

// Rout: Gegner ohne Einheiten ab Tag 2; sofort ohne Fabrik/Geld
{
  const s = game2(['A...B'], [['tank', 0, 0, 0], ['inf', 1, 4, 0]]);
  s.units.pop(); R.isOver(s);
  assert.strictEqual(s.winner, 0, 'kein Geld, keine Fabrik: sofort');
  const f = game2(['AF.GB'], [['tank', 0, 0, 0], ['inf', 1, 4, 0]], { funds: [0, 5000] });
  f.units.pop(); R.isOver(f);
  assert.strictEqual(f.winner, null, 'Tag 1: Gegner kann noch bauen');
  R.apply(f, { type: 'end' }); R.apply(f, { type: 'end' });
  assert.strictEqual(f.winner, 0, 'Tag 2: keine Einheiten');
}

// survive nach N Tagen, dayLimit
{
  const s = game2(['A...B'], [['inf', 0, 0, 0], ['inf', 1, 4, 0]], { objective: { type: 'survive', days: 2 } });
  for (let i = 0; i < 3; i++) R.apply(s, { type: 'end' });
  assert.strictEqual(s.winner, null, 'Tag 2 läuft noch');
  R.apply(s, { type: 'end' });
  assert.strictEqual(s.day, 3);
  assert.strictEqual(s.winner, 0, 'Azur überlebt 2 Tage');
  const d = game2(['A1.2B'], [['inf', 0, 0, 0], ['inf', 1, 4, 0]], { objective: { type: 'rout', dayLimit: 1 } });
  d.tiles[1].owner = 1; d.tiles[3].owner = 1;
  R.apply(d, { type: 'end' }); R.apply(d, { type: 'end' });
  assert.strictEqual(d.winner, 1, 'Tageslimit: mehr Gebäude');
}

// Kraft: Ladung 0, aktiv bis Zugende, Heilen, Voraussetzung
{
  const s = game2(['A...B'], [['inf', 0, 0, 0], ['inf', 1, 4, 0]]);
  assert.throws(() => R.apply(s, { type: 'power' }), 'zu wenig Ladung');
  const u = R.unitAt(s, 0, 0); u.hp = 50;
  s.players[0].charge = 3 * AW.POWER_STAR + 5;
  R.apply(s, { type: 'power' });
  assert.strictEqual(s.players[0].charge, 0);
  assert(s.players[0].powerActive);
  assert.strictEqual(u.hp, 70, 'Sammelruf heilt 20');
  assert.throws(() => R.apply(s, { type: 'power' }), 'schon aktiv');
  R.apply(s, { type: 'end' });
  assert(!s.players[0].powerActive, 'Kraft endet mit dem Zug');
}

console.log('rules.test.js OK');
