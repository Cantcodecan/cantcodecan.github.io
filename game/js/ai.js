// KI-Gegner (Leicht, Mittel, Schwer, Sehr schwer). Kein DOM, nutzt nur AW.rules. Regeln: docs/AI.md
(function (g) {
  const AW = (g.AW = g.AW || {});
  const R = AW.rules;

  const dispHp = (hp) => Math.ceil(hp / 10);
  const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const value = (u) => AW.UNITS[u.type].cost * u.hp / 100;
  const isProp = (t) => !!AW.TERRAIN[t.terrain].property;

  // Bedrohung ist in % Basisschaden summiert; der Faktor bringt sie auf die Größenordnung der Distanzstrafe (siehe AI.md)
  const THREAT_SCALE = 10;

  // Parameter je Stufe; Sehr schwer = Schwer plus Beam-Search
  const LEVELS = {
    easy:   { counterWeight: 0, threatWeight: 0, random: true },
    normal: { counterWeight: 1, threatWeight: 0.5 },
    hard:   { counterWeight: 1.2, threatWeight: 1, global: true },
  };
  LEVELS.brutal = { ...LEVELS.hard, beam: true, beamWidth: 8, branch: 3, counterTop: 0, pathWeight: 1, timeBudgetMs: 1200 };

  // Bewegungskosten-Distanz von allen Feldern zu den Zielfeldern (ohne Einheiten)
  function distanceMap(s, moveType, targets) {
    const costs = AW.MOVE_COST[moveType], d = new Float64Array(s.w * s.h).fill(Infinity);
    const open = [];
    for (const [x, y] of targets) { d[y * s.w + x] = 0; open.push([0, x, y]); }
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [c, x, y] = open.shift();
      if (c > d[y * s.w + x]) continue;
      // Ein Zug von (nx,ny) nach (x,y) kostet das Betreten von (x,y)
      const step = costs[R.tileAt(s, x, y).terrain];
      if (step === undefined) continue;
      for (const [dx, dy] of NEIGH) {
        const nx = x + dx, ny = y + dy, t = R.tileAt(s, nx, ny);
        if (!t || costs[t.terrain] === undefined) continue;
        const nc = c + step, k = ny * s.w + nx;
        if (nc < d[k]) { d[k] = nc; open.push([nc, nx, ny]); }
      }
    }
    return d;
  }

  // Distanzkarten je Bewegungsart und Zieltyp ('cap' = fremde Gebäude, 'foe' = gegnerische Einheiten), einmal pro Zug
  function distanceMaps(s, p) {
    const props = [], foes = [];
    s.tiles.forEach((t, i) => { if (isProp(t) && t.owner !== p) props.push([i % s.w, Math.floor(i / s.w)]); });
    for (const u of s.units) if (u.owner !== p) foes.push([u.x, u.y]);
    const maps = {};
    for (const mt of Object.keys(AW.MOVE_COST)) {
      maps[mt + ':cap'] = props.length ? distanceMap(s, mt, props) : null;
      maps[mt + ':foe'] = foes.length ? distanceMap(s, mt, foes) : null;
    }
    return maps;
  }

  // threat[Feld] = Summe des maximalen Basisschadens (%) der Gegner, die dieses Feld im nächsten Zug treffen könnten
  function threatMap(s, p) {
    const threat = new Float64Array(s.w * s.h);
    const mine = new Set(s.units.filter((u) => u.owner === p).map((u) => u.type));
    for (const e of s.units) {
      if (e.owner === p) continue;
      const def = AW.UNITS[e.type];
      let best = 0;
      for (const ty of mine) best = Math.max(best, AW.DAMAGE[e.type][ty] || 0);
      if (!best) continue;
      const dmg = best * dispHp(e.hp) / 10;
      const covered = new Set();
      const spots = def.minRange > 1 ? [{ x: e.x, y: e.y }] : R.reachable(s, e);
      for (const r of spots) {
        for (let dy = -def.maxRange; dy <= def.maxRange; dy++) {
          for (let dx = -def.maxRange; dx <= def.maxRange; dx++) {
            const d = Math.abs(dx) + Math.abs(dy);
            if (d < def.minRange || d > def.maxRange) continue;
            const x = r.x + dx, y = r.y + dy;
            if (R.tileAt(s, x, y)) covered.add(y * s.w + x);
          }
        }
      }
      for (const k of covered) threat[k] += dmg;
    }
    return threat;
  }

  function isCapturing(s, u) {
    const t = R.tileAt(s, u.x, u.y);
    return !!AW.UNITS[u.type].capture && isProp(t) && t.owner !== u.owner && t.cp < AW.ECONOMY.capturePoints;
  }

  // Indirekte Einheiten halten ihre Reichweite als Abstand zum Ziel
  function nearestDist(s, u, x, y, ctx) {
    const def = AW.UNITS[u.type];
    const kind = def.capture && ctx.maps[def.moveType + ':cap'] ? 'cap' : 'foe';
    const m = ctx.maps[def.moveType + ':' + kind];
    if (!m) return 0;
    const d = m[y * s.w + x];
    if (!isFinite(d)) return 50;
    return def.minRange > 1 ? Math.max(0, d - def.maxRange) : d;
  }

  // Alle Kandidaten einer Einheit: [{score, action}]
  function scoreActions(s, u, ctx) {
    const out = [];
    const mine = ctx.p, def = AW.UNITS[u.type];
    for (const r of R.reachable(s, u)) {
      const moved = r.x !== u.x || r.y !== u.y;
      const t = R.tileAt(s, r.x, r.y);
      const block = t.owner === mine && AW.TERRAIN[t.terrain].builds && !R.unitAt(s, r.x, r.y) ? 3000 : 0;
      const stars = def.domain === 'air' ? 0 : AW.TERRAIN[t.terrain].def;
      const exposure = ctx.params.threatWeight * THREAT_SCALE * ctx.threat[r.y * s.w + r.x] * value(u) / 10000;

      const retreat = ctx.params.global && dispHp(u.hp) <= 3 && ctx.threat[u.y * s.w + u.x] > 0 && isProp(t) && t.owner === mine ? 2000 : 0;
      const guard = ctx.hqGuard && ctx.hq && r.x === ctx.hq.x && r.y === ctx.hq.y ? 5000 : 0;

      for (const tg of R.attackTargets(s, u, r.x, r.y, moved)) {
        const pv = R.previewAttack(s, u.id, r.x, r.y, tg.id);
        const dealt = Math.min(pv.dmg, tg.hp) / 100 * AW.UNITS[tg.type].cost * (isCapturing(s, tg) ? 1.5 : 1);
        const kill = pv.dmg >= tg.hp ? 0.5 * value(tg) : 0;
        const taken = pv.counter / 100 * def.cost;
        const focus = ctx.hqThreat && ctx.hqThreat.has(tg.id) ? 3 : 1;
        out.push({
          score: (dealt + kill) * focus - taken * ctx.params.counterWeight + stars * 10 - exposure - block,
          action: { type: 'move', id: u.id, x: r.x, y: r.y, then: { attack: tg.id } },
        });
      }

      if (def.capture && isProp(t) && t.owner !== mine) {
        const done = dispHp(u.hp) >= t.cp;
        out.push({
          score: 1500 + (done ? 2500 : 0) + (t.terrain === 'hq' ? 20000 : 0) - block,
          action: { type: 'move', id: u.id, x: r.x, y: r.y, then: 'capture' },
        });
      }

      const score = -120 * nearestDist(s, u, r.x, r.y, ctx) + 40 * stars * dispHp(u.hp) / 10 - exposure - block + retreat + guard;
      out.push({ score, action: { type: 'move', id: u.id, x: r.x, y: r.y, then: 'wait' } });
    }
    return out;
  }

  function chooseAction(cands, params, rng) {
    if (!params.random) return cands.reduce((a, b) => (b.score > a.score ? b : a));
    const scored = cands.map((c) => ({ c, v: c.score * (0.5 + rng()) })).sort((a, b) => b.v - a.v);
    return (scored.length > 1 && rng() < 0.25 ? scored[1] : scored[0]).c;
  }

  const powerReady = (s) => {
    const p = s.players[s.turn], pw = AW.COMMANDERS[p.co].power;
    return !p.powerActive && p.charge >= pw.stars * AW.POWER_STAR;
  };

  function freeProducers(s, p) {
    const out = [];
    s.tiles.forEach((t, i) => {
      const x = i % s.w, y = Math.floor(i / s.w);
      if (t.owner === p && AW.TERRAIN[t.terrain].builds && !R.unitAt(s, x, y)) out.push({ x, y });
    });
    return out;
  }

  // Nutzen eines Einheitentyps gegen die aktuelle gegnerische Aufstellung, bezogen auf seine Kosten
  function buildUse(s, p, type, cost) {
    let sum = 0;
    for (const e of s.units) {
      if (e.owner === p) continue;
      sum += (AW.DAMAGE[type][e.type] || 0) * value(e) - (AW.DAMAGE[e.type][type] || 0) * cost * 0.6;
    }
    return sum / cost;
  }

  // Produktion: Einnehmer zuerst, solange weniger als 3 existieren; sonst die teuerste Einheit mit positivem Nutzen
  function chooseBuilds(s, ctx) {
    const p = ctx.p, actions = [], built = [];
    const needHeal = s.units.some((u) => {
      const t = R.tileAt(s, u.x, u.y);
      return u.owner === p && u.hp < 100 && isProp(t) && t.owner === p;
    });
    const reserve = needHeal ? 1000 : 0;
    const capturers = s.units.filter((u) => u.owner === p && AW.UNITS[u.type].capture).length;
    const targetsLeft = s.tiles.some((t) => isProp(t) && t.owner !== p);
    for (const { x, y } of freeProducers(s, p)) {
      const funds = s.players[p].funds - reserve;
      const scored = R.buildOptions(s, x, y).filter((o) => o.cost <= funds).sort((a, b) => b.cost - a.cost)
        .map((o) => ({ ...o, use: buildUse(s, p, o.type, o.cost) }));
      const need = targetsLeft && capturers + built.filter((t) => AW.UNITS[t].capture).length < 3;
      let best = need ? scored.find((o) => AW.UNITS[o.type].capture) : null;
      if (!best) best = scored.find((o) => o.use > 0) || scored.reduce((m, o) => (!m || o.use > m.use ? o : m), null);
      if (!best) continue;
      const a = { type: 'build', x, y, unit: best.type };
      R.apply(s, a);
      actions.push(a);
      built.push(best.type);
    }
    return actions;
  }

  function randomBuilds(s, ctx, rng) {
    const actions = [];
    for (const { x, y } of freeProducers(s, ctx.p)) {
      if (actions.length >= 2) break;
      const opts = R.buildOptions(s, x, y).filter((o) => o.affordable);
      if (!opts.length) continue;
      const a = { type: 'build', x, y, unit: opts[Math.floor(rng() * opts.length)].type };
      R.apply(s, a);
      actions.push(a);
    }
    return actions;
  }

  // Gegnerische Einnehmer, die das eigene HQ in höchstens 2 Zügen erreichen
  function hqDanger(s, p) {
    const i = s.tiles.findIndex((t) => t.terrain === 'hq' && t.owner === p);
    if (i < 0) return { hq: null, threat: new Set() };
    const hq = { x: i % s.w, y: Math.floor(i / s.w) }, ids = new Set(), maps = {};
    for (const e of s.units) {
      const def = AW.UNITS[e.type];
      if (e.owner === p || !def.capture) continue;
      const m = maps[def.moveType] || (maps[def.moveType] = distanceMap(s, def.moveType, [[hq.x, hq.y]]));
      if (m[e.y * s.w + e.x] <= 2 * def.move) ids.add(e.id);
    }
    return { hq, threat: ids };
  }

  // Zustandsbewertung aus Sicht von Spieler p (AI.md)
  function evaluate(s, p) {
    if (s.winner === p) return 1e6;
    if (s.winner !== null) return s.winner === 'draw' ? 0 : -1e6;
    const cp = AW.ECONOMY.capturePoints;
    let v = 0;
    for (const u of s.units) v += (u.owner === p ? 1 : -1) * value(u);
    v += 1200 * (R.propertiesOf(s, p).length - R.propertiesOf(s, 1 - p).length);
    const threat = threatMap(s, p);
    for (const u of s.units) {
      const t = R.tileAt(s, u.x, u.y), sign = u.owner === p ? 1 : -1;
      if (AW.UNITS[u.type].capture && isProp(t) && t.owner !== u.owner) {
        v += sign * 300 * (cp - t.cp);
        if (t.terrain === 'hq' && t.cp <= dispHp(u.hp)) v += sign * 40000;
      }
      if (sign > 0) v -= 0.3 * threat[u.y * s.w + u.x] * value(u) / 10000;
    }
    return v + 0.5 * (s.players[p].funds - s.players[1 - p].funds);
  }

  // Schwer: globale Gier. Immer die global beste Aktion aller noch freien Einheiten ausführen.
  function planGreedy(state, params, usePower) {
    const s = R.clone(state), p = s.turn, actions = [];
    const run = (a) => { R.apply(s, a); actions.push(a); };
    if (usePower) run({ type: 'power' });
    const danger = hqDanger(s, p);
    const ctx = { p, params, maps: distanceMaps(s, p), threat: threatMap(s, p), hq: danger.hq, hqThreat: danger.threat, hqGuard: danger.threat.size > 0 };
    for (;;) {
      if (s.winner !== null) break;
      let best = null;
      for (const u of s.units) {
        if (u.owner !== p || u.acted) continue;
        for (const c of scoreActions(s, u, ctx)) if (!best || c.score > best.score) best = c;
      }
      if (!best) break;
      const foes = s.units.length;
      run(best.action);
      if (s.units.length < foes) ctx.threat = threatMap(s, p);
    }
    if (s.winner === null) actions.push(...chooseBuilds(s, ctx));
    return { s, actions, value: evaluate(s, p) };
  }

  // Beam-Search über den ganzen Zug (AI.md, Sehr schwer)
  function planBeam(state, params) {
    const t0 = Date.now(), p = state.turn, used = () => Date.now() - t0;
    const makeCtx = (s) => {
      const danger = hqDanger(s, p);
      return { p, params, maps: distanceMaps(s, p), threat: threatMap(s, p), hq: danger.hq, hqThreat: danger.threat, hqGuard: danger.threat.size > 0 };
    };
    const sig = (s) => s.units.map((u) => u.x + ',' + u.y + ',' + u.hp + (u.acted ? 'a' : '')).sort().join('|') + s.players[p].charge + (s.players[p].powerActive ? 'P' : '');
    const start = (usePower) => {
      const s = R.clone(state), actions = [];
      if (usePower) { R.apply(s, { type: 'power' }); actions.push({ type: 'power' }); }
      return { s, actions, ctx: makeCtx(s), v: 0, g: 0 };
    };
    let beam = [start(false)];
    if (powerReady(state)) beam.push(start(true));
    const done = [];
    while (beam.length) {
      const late = used() > params.timeBudgetMs * 0.6, urgent = used() > params.timeBudgetMs * 0.9;
      const width = late ? params.beamWidth / 2 : params.beamWidth, branch = urgent ? 1 : late ? 2 : params.branch;
      const next = new Map();
      for (const st of beam) {
        const bestPerUnit = [];
        if (st.s.winner === null) {
          for (const u of st.s.units) {
            if (u.owner !== p || u.acted) continue;
            let b = null;
            for (const c of scoreActions(st.s, u, st.ctx)) if (!b || c.score > b.score) b = c;
            if (b) bestPerUnit.push(b);
          }
        }
        if (!bestPerUnit.length) { done.push(st); continue; }
        bestPerUnit.sort((a, b) => b.score - a.score);
        for (const c of bestPerUnit.slice(0, branch)) {
          const s = R.clone(st.s), before = s.units.length;
          R.apply(s, c.action);
          const ctx = s.units.length < before ? { ...st.ctx, threat: threatMap(s, p) } : st.ctx;
          const g = st.g + c.score, ns = { s, actions: [...st.actions, c.action], ctx, g, v: evaluate(s, p) + params.pathWeight * g };
          const k = sig(s);
          if (!next.has(k) || next.get(k).v < ns.v) next.set(k, ns);
        }
      }
      beam = [...next.values()].sort((a, b) => b.v - a.v).slice(0, width);
    }
    for (const st of done) {
      if (st.s.winner === null) st.actions.push(...chooseBuilds(st.s, st.ctx));
      st.v = evaluate(st.s, p);
    }
    done.sort((a, b) => b.v - a.v);
    let best = done[0];
    // Gegenzug-Check: Gegner mit Stufe Mittel simulieren, Zustand danach neu bewerten
    let bestV = -Infinity;
    for (const st of done.slice(0, params.counterTop)) {
      if (st.s.winner !== null) { best = st; break; }
      if (used() > params.timeBudgetMs && bestV > -Infinity) break;
      const s = R.clone(st.s);
      R.apply(s, { type: 'end' });
      if (s.winner === null) for (const a of planTurn(s, 'normal')) { R.apply(s, a); if (s.winner !== null) break; }
      const v = evaluate(s, p) + params.pathWeight * st.g;
      if (v > bestV) { bestV = v; best = st; }
    }
    if (best.s.winner === null) best.actions.push({ type: 'end' });
    return best.actions;
  }

  function planHard(state, params) {
    let best = planGreedy(state, params, false);
    if (powerReady(state)) {
      const alt = planGreedy(state, params, true);
      if (alt.value > best.value) best = alt;
    }
    if (best.s.winner === null) best.actions.push({ type: 'end' });
    return best.actions;
  }

  function planTurn(state, level, opts = {}) {
    const rng = opts.rng || Math.random;
    const params = LEVELS[level];
    if (!params) throw new Error('Unbekannte KI-Stufe: ' + level);
    if (params.beam) return planBeam(state, params);
    if (params.global) return planHard(state, params);
    const s = R.clone(state), p = s.turn, actions = [];
    const run = (a) => { R.apply(s, a); actions.push(a); };

    if (powerReady(s) && (!params.random || rng() < 0.5)) run({ type: 'power' });

    const ctx = { p, params, maps: distanceMaps(s, p), threat: threatMap(s, p) };
    const order = s.units.filter((u) => u.owner === p && !u.acted);
    if (params.random) order.sort(() => rng() - 0.5);
    else order.sort((a, b) => (AW.UNITS[b.type].minRange > 1) - (AW.UNITS[a.type].minRange > 1) || AW.UNITS[b.type].cost - AW.UNITS[a.type].cost);

    for (const u0 of order) {
      if (s.winner !== null) break;
      const u = s.units.find((x) => x.id === u0.id);
      if (!u || u.acted) continue;
      run(chooseAction(scoreActions(s, u, ctx), params, rng).action);
    }

    if (s.winner === null) {
      actions.push(...(params.random ? randomBuilds(s, ctx, rng) : chooseBuilds(s, ctx)));
      actions.push({ type: 'end' });
    }
    return actions;
  }

  AW.ai = { planTurn, scoreAction: scoreActions, threatMap, distanceMaps, chooseBuilds, evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = AW.ai;
})(globalThis);
