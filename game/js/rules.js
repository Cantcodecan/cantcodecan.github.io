// Zustand und Regeln – reine Funktionen, kein DOM. Regeln: docs/DESIGN.md §2–7, §10
(function (g) {
  const AW = (g.AW = g.AW || {});

  const clone = (s) => structuredClone(s);
  const tileAt = (s, x, y) => (x >= 0 && y >= 0 && x < s.w && y < s.h ? s.tiles[y * s.w + x] : null);
  const unitAt = (s, x, y) => s.units.find((u) => u.x === x && u.y === y) || null;
  const unitById = (s, id) => s.units.find((u) => u.id === id) || null;
  const dispHp = (hp) => Math.ceil(hp / 10);
  const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
  const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function groupsOf(def) {
    const direct = def.minRange === 1;
    const gs = ['all', direct ? 'direct' : 'indirect'];
    if (direct && def.domain === 'ground') gs.push('directGround');
    if (def.domain === 'air') gs.push('air');
    return gs;
  }

  // Summe der Boni einer CO-Tabelle (z. B. atk, moveBonus) für die Gruppen einer Einheit
  function bonusFor(table, def) {
    if (!table) return 0;
    let sum = 0;
    for (const gr of groupsOf(def)) sum += table[gr] || 0;
    return sum;
  }

  function coOf(s, owner) { return AW.COMMANDERS[s.players[owner].co]; }

  function atkBonus(s, unit) {
    const co = coOf(s, unit.owner), p = s.players[unit.owner], def = AW.UNITS[unit.type];
    return bonusFor(co.atk, def) + (p.powerActive ? bonusFor(co.power.atk, def) : 0);
  }

  function newGame(mapDef, opts = {}) {
    const w = mapDef.map[0].length, h = mapDef.map.length;
    const tiles = [];
    for (const row of mapDef.map) {
      for (const ch of row) {
        const [terrain, owner] = AW.TILE_CHARS[ch];
        tiles.push({ terrain, owner, cp: AW.ECONOMY.capturePoints });
      }
    }
    const co = opts.co || mapDef.co;
    const ai = opts.ai || [null, null];
    const funds = opts.funds || mapDef.funds || [0, 0];
    const state = {
      w, h, day: 1, turn: 0, tiles, units: [], nextId: 1, winner: null,
      players: [0, 1].map((i) => ({ funds: funds[i], co: co[i], charge: 0, powerActive: false, ai: ai[i] || null })),
      objective: mapDef.objective, build: mapDef.build || null, difficulty: opts.difficulty || 'normal',
    };
    for (const [type, owner, x, y] of mapDef.units) {
      state.units.push({ id: state.nextId++, type, owner, x, y, hp: 100, acted: false, moved: false });
    }
    return state;
  }

  function moveAllowance(s, unit) {
    const def = AW.UNITS[unit.type], p = s.players[unit.owner];
    return def.move + (p.powerActive ? bonusFor(coOf(s, unit.owner).power.moveBonus, def) : 0);
  }

  // Dijkstra über 4 Nachbarn; durch Gegner kein Durchzug, Ziel muss frei sein (außer Startfeld)
  function reachable(s, unit) {
    const def = AW.UNITS[unit.type], costs = AW.MOVE_COST[def.moveType];
    const maxCost = moveAllowance(s, unit);
    const best = new Map([[unit.y * s.w + unit.x, 0]]);
    const open = [[0, unit.x, unit.y]];
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [c, x, y] = open.shift();
      if (c > best.get(y * s.w + x)) continue;
      for (const [dx, dy] of NEIGH) {
        const nx = x + dx, ny = y + dy, t = tileAt(s, nx, ny);
        if (!t) continue;
        const step = costs[t.terrain];
        if (step === undefined) continue;
        const other = unitAt(s, nx, ny);
        if (other && other.owner !== unit.owner) continue;
        const nc = c + step;
        if (nc > maxCost) continue;
        const k = ny * s.w + nx;
        if (best.has(k) && best.get(k) <= nc) continue;
        best.set(k, nc);
        open.push([nc, nx, ny]);
      }
    }
    const out = [];
    for (const [k, cost] of best) {
      const x = k % s.w, y = Math.floor(k / s.w), other = unitAt(s, x, y);
      if (other && other !== unit) continue;
      out.push({ x, y, cost });
    }
    return out;
  }

  function attackTargets(s, unit, x, y, moved) {
    const def = AW.UNITS[unit.type], dmg = AW.DAMAGE[unit.type];
    if (def.minRange > 1 && moved) return [];
    const p = s.players[unit.owner];
    const extra = p.powerActive ? bonusFor(coOf(s, unit.owner).power.rangeBonus, def) : 0;
    const maxR = def.maxRange + extra;
    return s.units.filter((t) => {
      if (t.owner === unit.owner || dmg[t.type] === undefined) return false;
      const d = dist(x, y, t.x, t.y);
      return d >= def.minRange && d <= maxR;
    });
  }

  // Schaden von att auf def; Sterne vom Feld des Verteidigers (0 bei Lufteinheiten)
  function damage(s, att, def, attX, attY) {
    const base = AW.DAMAGE[att.type][def.type];
    if (base === undefined) return 0;
    const stars = AW.UNITS[def.type].domain === 'air' ? 0 : AW.TERRAIN[tileAt(s, def.x, def.y).terrain].def;
    const num = base * (100 + atkBonus(s, att)) * dispHp(att.hp) * (100 - stars * dispHp(def.hp));
    return Math.max(0, Math.floor(num / 100000));
  }

  // Gegenschaden, falls das Ziel nach dmg überlebt und zurückschlagen darf
  function counterDamage(s, att, def, attX, attY, dmg) {
    if (def.hp - dmg <= 0 || AW.UNITS[def.type].minRange !== 1) return 0;
    if (dist(attX, attY, def.x, def.y) !== 1 || AW.DAMAGE[def.type][att.type] === undefined) return 0;
    const d = { ...def, hp: def.hp - dmg };
    const a = { ...att, x: attX, y: attY };
    return damage(s, d, a, def.x, def.y);
  }

  function previewAttack(s, id, x, y, targetId) {
    const att = unitById(s, id), def = unitById(s, targetId);
    const a = { ...att, x, y };
    const dmg = damage(s, a, def, x, y);
    return { dmg, counter: counterDamage(s, a, def, x, y, dmg) };
  }

  function addCharge(s, owner, dmgDealt, targetType, share) {
    s.players[owner].charge += Math.round(dmgDealt / 100 * AW.UNITS[targetType].cost * share);
  }

  function resetCapture(s, x, y) {
    const t = tileAt(s, x, y);
    if (t) t.cp = AW.ECONOMY.capturePoints;
  }

  function removeUnit(s, u) {
    s.units.splice(s.units.indexOf(u), 1);
    resetCapture(s, u.x, u.y);
  }

  // Verlust-/Schadensbuchführung für einen Schlag: attacker -> defender
  function strike(s, att, def, dmg) {
    const lost = Math.min(dmg, def.hp);
    def.hp -= dmg;
    addCharge(s, att.owner, lost, def.type, 0.5);
    addCharge(s, def.owner, lost, def.type, 1);
    if (def.hp <= 0) removeUnit(s, def);
  }

  function applyMove(s, a) {
    const unit = unitById(s, a.id);
    if (!unit || unit.owner !== s.turn || unit.acted) throw new Error('Einheit nicht handlungsfähig');
    if (!reachable(s, unit).some((r) => r.x === a.x && r.y === a.y)) throw new Error('Feld nicht erreichbar');
    const moved = a.x !== unit.x || a.y !== unit.y;
    if (moved) resetCapture(s, unit.x, unit.y);
    unit.x = a.x; unit.y = a.y; unit.moved = moved;
    const then = a.then || 'wait';
    if (then !== 'wait' && then !== 'capture' && !then.attack) throw new Error('Aktion nicht unterstützt: ' + then);
    if (then === 'capture') capture(s, unit);
    if (then.attack) {
      const target = unitById(s, then.attack);
      if (!target || !attackTargets(s, unit, unit.x, unit.y, moved).includes(target)) throw new Error('Ziel nicht angreifbar');
      const dmg = damage(s, unit, target, unit.x, unit.y);
      const counter = counterDamage(s, unit, target, unit.x, unit.y, dmg);
      strike(s, unit, target, dmg);
      if (counter > 0) strike(s, target, unit, counter);
    }
    if (s.units.includes(unit)) unit.acted = true;
  }

  const isProperty = (t) => !!AW.TERRAIN[t.terrain].property;

  // Gebäude von Spieler p als [{x,y,terrain}]
  function propertiesOf(s, p) {
    const out = [];
    s.tiles.forEach((t, i) => {
      if (t.owner === p && isProperty(t)) out.push({ x: i % s.w, y: Math.floor(i / s.w), terrain: t.terrain });
    });
    return out;
  }

  function capture(s, unit) {
    const t = tileAt(s, unit.x, unit.y);
    if (!AW.UNITS[unit.type].capture || !isProperty(t) || t.owner === unit.owner) throw new Error('Einnehmen nicht möglich');
    t.cp -= dispHp(unit.hp);
    if (t.cp <= 0) {
      t.owner = unit.owner;
      t.cp = AW.ECONOMY.capturePoints;
      if (t.terrain === 'hq') s.winner = unit.owner;
    }
  }

  function unitCost(s, owner, type) {
    const def = AW.UNITS[type], mod = bonusFor(coOf(s, owner).costMod, def);
    return Math.round(def.cost * (100 + mod) / 100);
  }

  // Baubare Einheiten auf (x,y) für den aktiven Spieler: [{type, cost, affordable}]
  function buildOptions(s, x, y) {
    const t = tileAt(s, x, y), owner = s.turn;
    if (!t || t.owner !== owner || !AW.TERRAIN[t.terrain].builds || unitAt(s, x, y)) return [];
    return AW.BUILD_LISTS[AW.TERRAIN[t.terrain].builds]
      .filter((type) => !s.build || s.build.includes(type))
      .map((type) => { const cost = unitCost(s, owner, type); return { type, cost, affordable: cost <= s.players[owner].funds }; });
  }

  function applyBuild(s, a) {
    const opt = buildOptions(s, a.x, a.y).find((o) => o.type === a.unit);
    if (!opt) throw new Error('Bauen nicht möglich');
    if (!opt.affordable) throw new Error('Zu wenig Geld');
    s.players[s.turn].funds -= opt.cost;
    s.units.push({ id: s.nextId++, type: a.unit, owner: s.turn, x: a.x, y: a.y, hp: 100, acted: true, moved: false });
  }

  function applyPower(s) {
    const p = s.players[s.turn], pw = coOf(s, s.turn).power;
    if (p.powerActive || p.charge < pw.stars * AW.POWER_STAR) throw new Error('Kraft nicht bereit');
    p.charge = 0;
    p.powerActive = true;
    if (pw.heal) for (const u of s.units) if (u.owner === s.turn) u.hp = Math.min(100, u.hp + pw.heal);
  }

  function startTurn(s) {
    const p = s.players[s.turn];
    const mul = p.ai ? AW.DIFFICULTY[s.difficulty].incomeMul : 1;
    p.funds += Math.round(AW.ECONOMY.incomePerProperty * propertiesOf(s, s.turn).length * mul);
    for (const u of s.units) {
      if (u.owner !== s.turn) continue;
      const def = AW.UNITS[u.type], t = tileAt(s, u.x, u.y);
      const fits = t.owner === s.turn && isProperty(t) &&
        (t.terrain === 'airport' ? def.domain === 'air' : def.domain === 'ground');
      if (fits && u.hp < 100) {
        const heal = Math.min(AW.ECONOMY.healHp, 100 - u.hp);
        const cost = Math.round(def.cost * AW.ECONOMY.healCostFactor * heal / 10);
        if (p.funds >= cost) { p.funds -= cost; u.hp += heal; }
      }
      u.acted = false; u.moved = false;
    }
  }

  function applyEnd(s) {
    s.players[s.turn].powerActive = false;
    s.turn = 1 - s.turn;
    if (s.turn === 0) s.day++;
    startTurn(s);
  }

  function canBuild(s, p) {
    const funds = s.players[p].funds;
    return s.tiles.some((t, i) => {
      if (t.owner !== p || !AW.TERRAIN[t.terrain].builds) return false;
      const list = AW.BUILD_LISTS[AW.TERRAIN[t.terrain].builds].filter((ty) => !s.build || s.build.includes(ty));
      return list.some((ty) => unitCost(s, p, ty) <= funds);
    });
  }

  // Prüft Siegbedingungen (§7), setzt state.winner (0, 1 oder 'draw') und gibt true zurück, wenn das Spiel endet
  function isOver(s) {
    if (s.winner !== null) return true;
    const obj = s.objective || { type: 'rout' };
    const hqLost = (p) => !s.tiles.some((t) => t.terrain === 'hq' && t.owner === p);
    for (const p of [0, 1]) {
      if (hqLost(p)) { s.winner = 1 - p; return true; }
    }
    for (const p of [0, 1]) {
      if (s.units.some((u) => u.owner === p)) continue;
      const out = p === s.turn ? !canBuild(s, p) : (s.day >= 2 || !canBuild(s, p));
      if (out) { s.winner = 1 - p; return true; }
    }
    if (obj.type === 'survive' && s.day > obj.days) { s.winner = 0; return true; }
    if (s.day > (obj.dayLimit || AW.ECONOMY.dayLimit)) {
      const a = propertiesOf(s, 0).length, b = propertiesOf(s, 1).length;
      s.winner = a > b ? 0 : b > a ? 1 : 'draw';
      return true;
    }
    return false;
  }

  function apply(s, action) {
    if (s.winner !== null) throw new Error('Spiel beendet');
    if (action.type === 'move') applyMove(s, action);
    else if (action.type === 'build') applyBuild(s, action);
    else if (action.type === 'power') applyPower(s);
    else if (action.type === 'end') applyEnd(s);
    else throw new Error('Aktion nicht unterstützt: ' + action.type);
    isOver(s);
    return s;
  }

  AW.rules = { newGame, clone, unitAt, tileAt, reachable, attackTargets, damage, previewAttack, apply, isOver, propertiesOf, buildOptions };
  if (typeof module !== 'undefined' && module.exports) module.exports = AW.rules;
})(globalThis);
