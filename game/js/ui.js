// Eingabe und Spielsteuerung (Hot-Seat). Zustandsautomat: idle → selected → menu → target
(function (g) {
  const AW = (g.AW = g.AW || {});
  const R = AW.rules, V = AW.render;
  const $ = (id) => document.getElementById(id);
  const key = (x, y) => x + ',' + y;
  const dispHp = (hp) => Math.ceil(hp / 10);
  const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const S = { state: null, mode: 'idle', unit: null, reach: new Map(), atk: new Set(), pend: null, targets: [], aim: null, busy: false };

  function start(mapDef, opts) {
    S.state = R.newGame(mapDef, opts || { co: ['mira', 'varek'] });
    $('overlay').classList.remove('show');
    reset();
    refresh();
  }

  function reset() {
    S.mode = 'idle'; S.unit = null; S.reach = new Map(); S.atk = new Set(); S.pend = null; S.targets = []; S.aim = null;
    renderMenu([]);
  }

  // kürzester Pfad (auch durch eigene Einheiten) vom Start zu (x,y) als [{x,y}…]
  function pathTo(unit, x, y) {
    const s = S.state, costs = AW.MOVE_COST[AW.UNITS[unit.type].moveType];
    const dist = new Map([[key(unit.x, unit.y), 0]]), prev = new Map(), open = [[0, unit.x, unit.y]];
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [c, cx, cy] = open.shift();
      if (c > dist.get(key(cx, cy))) continue;
      for (const [dx, dy] of NEIGH) {
        const nx = cx + dx, ny = cy + dy, t = R.tileAt(s, nx, ny);
        if (!t || costs[t.terrain] === undefined) continue;
        const o = R.unitAt(s, nx, ny);
        if (o && o.owner !== unit.owner) continue;
        const nc = c + costs[t.terrain], k = key(nx, ny);
        if (dist.has(k) && dist.get(k) <= nc) continue;
        dist.set(k, nc); prev.set(k, { x: cx, y: cy }); open.push([nc, nx, ny]);
      }
    }
    const path = [{ x, y }];
    while (key(path[0].x, path[0].y) !== key(unit.x, unit.y)) path.unshift(prev.get(key(path[0].x, path[0].y)));
    return path;
  }

  function view() {
    const v = { reach: new Set(S.reach.keys()), atk: S.atk };
    if (S.unit) v.sel = key(S.unit.x, S.unit.y);
    if (S.pend) {
      v.override = { id: S.unit.id, x: S.pend.x, y: S.pend.y };
      v.reach = new Set(); v.atk = new Set(S.targets.map((t) => key(t.x, t.y)));
    }
    return v;
  }

  function refresh() {
    const s = S.state;
    V.draw(s, view());
    const p = s.players[s.turn], co = AW.COMMANDERS[p.co], fac = AW.FACTIONS[s.turn];
    $('who').textContent = `Tag ${s.day} · ${fac.name}`;
    $('who').style.color = fac.color;
    $('co').textContent = `${co.name} · ${p.funds} Geld`;
    $('portrait').innerHTML = `<svg viewBox="0 0 64 64">${AW.icons.portrait(p.co)}</svg>`;
    const need = co.power.stars * AW.POWER_STAR;
    $('charge').firstElementChild.style.width = Math.min(100, p.charge / need * 100) + '%';
    const ready = !p.powerActive && p.charge >= need;
    $('charge').classList.toggle('ready', ready);
    $('power').textContent = p.powerActive ? `${co.power.name} aktiv` : co.power.name;
    $('power').disabled = !ready || s.winner !== null;
    $('end').disabled = s.winner !== null;
    if (s.winner !== null) showWinner();
  }

  function showWinner() {
    const w = S.state.winner;
    $('overlayText').textContent = w === 'draw' ? 'Unentschieden' : `${AW.FACTIONS[w].name} siegt!`;
    $('overlay').classList.add('show');
  }

  function info(html) { $('info').innerHTML = html; }

  function unitInfo(u) {
    const d = AW.UNITS[u.type], fac = AW.FACTIONS[u.owner];
    const range = d.minRange === d.maxRange ? d.maxRange : `${d.minRange}–${d.maxRange}`;
    info(`<b style="color:${fac.color}">${d.name}</b> · HP ${dispHp(u.hp)}/10<br><small>Bewegung ${d.move} · Reichweite ${range}</small><br>${d.desc}`);
  }

  function terrainInfo(x, y) {
    const t = R.tileAt(S.state, x, y), d = AW.TERRAIN[t.terrain];
    let extra = '';
    if (d.property) {
      extra = t.owner === null ? ' · neutral' : ` · ${AW.FACTIONS[t.owner].name}`;
      if (t.cp < AW.ECONOMY.capturePoints) extra += ` · Einnahme ${t.cp}/${AW.ECONOMY.capturePoints}`;
    }
    info(`<b>${d.name}</b> · Verteidigung ${'★'.repeat(d.def) || '–'}${extra}`);
  }

  function renderMenu(items, cls = '') {
    const m = $('menu');
    m.className = cls;
    m.innerHTML = '';
    for (const [label, fn, opts = {}] of items) {
      const b = document.createElement('button');
      if (opts.right) { b.innerHTML = `<span>${label}</span><span>${opts.right}</span>`; } else b.textContent = label;
      if (opts.ghost) b.className = 'ghost';
      b.disabled = !!opts.disabled;
      b.onclick = () => { if (!S.busy) fn(); };
      m.appendChild(b);
    }
  }

  function selectUnit(u) {
    const s = S.state;
    S.unit = u; S.mode = 'selected'; S.pend = null;
    S.reach = new Map(R.reachable(s, u).map((r) => [key(r.x, r.y), r.cost]));
    S.atk = new Set();
    for (const k of S.reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      for (const t of R.attackTargets(s, u, x, y, x !== u.x || y !== u.y)) S.atk.add(key(t.x, t.y));
    }
    renderMenu([]);
    unitInfo(u);
    refresh();
  }

  function canCapture(u, x, y) {
    const t = R.tileAt(S.state, x, y);
    return !!AW.UNITS[u.type].capture && !!AW.TERRAIN[t.terrain].property && t.owner !== u.owner;
  }

  async function moveTo(x, y) {
    const u = S.unit;
    S.busy = true;
    const moved = x !== u.x || y !== u.y;
    if (moved) await V.moveUnit(u.id, pathTo(u, x, y));
    S.busy = false;
    S.pend = { x, y };
    S.targets = R.attackTargets(S.state, u, x, y, moved);
    S.mode = 'menu';
    const items = [];
    if (S.targets.length) items.push(['Angreifen', startAim]);
    if (canCapture(u, x, y)) items.push(['Einnehmen', () => commit('capture')]);
    items.push(['Warten', () => commit('wait')]);
    items.push(['Abbrechen', cancel, { ghost: true }]);
    renderMenu(items);
    refresh();
  }

  function startAim() {
    S.mode = 'target'; S.aim = null;
    renderMenu([['Abbrechen', back, { ghost: true }]]);
    info('Ziel wählen (zweiter Klick bestätigt).');
    refresh();
  }

  function preview(t) {
    const p = R.previewAttack(S.state, S.unit.id, S.pend.x, S.pend.y, t.id);
    const d = AW.UNITS[t.type];
    info(`${d.name} (HP ${dispHp(t.hp)}) · Schaden <b>${p.dmg}</b>${p.counter ? ` · Gegenschaden <b>${p.counter}</b>` : ''}`);
  }

  // Aktion bestätigen: Regeln anwenden, Effekte zeigen
  async function commit(then) {
    const s = S.state, u = S.unit, p = S.pend;
    const before = new Map(s.units.map((x) => [x.id, x.hp]));
    const action = { type: 'move', id: u.id, x: p.x, y: p.y, then };
    const pos = new Map(s.units.map((x) => [x.id, { x: x.x, y: x.y }]));
    pos.set(u.id, p);
    R.apply(s, action);
    const tile = R.tileAt(s, p.x, p.y);
    reset();
    refresh();
    if (then === 'capture') info(tile.owner === u.owner ? 'Gebäude eingenommen!' : `Einnahme: noch ${tile.cp} Punkte`);
    else info('');
    if (then.attack) {
      S.busy = true;
      for (const [id, hp0] of before) {
        const now = s.units.find((x) => x.id === id), hp1 = now ? now.hp : 0;
        if (hp1 === hp0) continue;
        const at = pos.get(id), loss = Math.max(1, dispHp(hp0) - dispHp(hp1));
        V.floatText(at.x, at.y, '-' + (now ? loss : dispHp(hp0)), id === u.id ? 'counter' : '');
        if (now) V.flash(id);
      }
      await V.wait(500);
      S.busy = false;
    }
  }

  function cancel() { reset(); info(''); refresh(); }
  function back() { // eine Stufe zurück
    if (S.mode === 'target') {
      S.mode = 'menu'; S.aim = null;
      const items = [['Angreifen', startAim]];
      if (canCapture(S.unit, S.pend.x, S.pend.y)) items.push(['Einnehmen', () => commit('capture')]);
      items.push(['Warten', () => commit('wait')], ['Abbrechen', cancel, { ghost: true }]);
      renderMenu(items); info(''); refresh();
    } else cancel();
  }

  function openBuild(x, y) {
    const opts = R.buildOptions(S.state, x, y);
    if (!opts.length) return false;
    renderMenu(opts.map((o) => [AW.UNITS[o.type].name, () => {
      R.apply(S.state, { type: 'build', x, y, unit: o.type });
      reset(); info(''); refresh();
    }, { right: o.cost, disabled: !o.affordable }]).concat([['Abbrechen', cancel, { ghost: true }]]), 'build');
    info('<b>Bauen</b>');
    return true;
  }

  function onTile(x, y) {
    const s = S.state;
    if (S.busy || s.winner !== null) return;
    const u = R.unitAt(s, x, y), k = key(x, y);
    if (S.mode === 'selected') {
      if (S.reach.has(k)) return moveTo(x, y);
      if (u && u.owner === s.turn && !u.acted) return selectUnit(u);
      cancel(); return onTile(x, y);
    }
    if (S.mode === 'menu') return cancel();
    if (S.mode === 'target') {
      const t = S.targets.find((e) => e.x === x && e.y === y);
      if (!t) return back();
      if (S.aim === t.id) return commit({ attack: t.id });
      S.aim = t.id; preview(t); return;
    }
    // idle
    if (u && u.owner === s.turn && !u.acted) return selectUnit(u);
    if (u) return unitInfo(u);
    if (!openBuild(x, y)) terrainInfo(x, y);
  }

  function onHover(x, y) {
    if (S.mode !== 'target' || S.busy) return;
    const t = S.targets.find((e) => e.x === x && e.y === y);
    if (t) preview(t);
  }

  async function endTurn() {
    if (S.busy || S.state.winner !== null) return;
    R.apply(S.state, { type: 'end' });
    reset(); info(''); refresh();
  }

  function usePower() {
    if (S.busy) return;
    R.apply(S.state, { type: 'power' });
    reset(); info('Kraft aktiviert!'); refresh();
  }

  function init() {
    V.init($('board'));
    const tileOf = (e) => { const t = e.target.closest('.tile'); return t ? [+t.dataset.x, +t.dataset.y] : null; };
    $('board').addEventListener('click', (e) => { const p = tileOf(e); if (p) onTile(...p); });
    $('board').addEventListener('mouseover', (e) => { const p = tileOf(e); if (p) onHover(...p); });
    $('board').addEventListener('contextmenu', (e) => { e.preventDefault(); if (!S.busy) back(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !S.busy) back(); });
    $('end').onclick = endTurn;
    $('power').onclick = usePower;
    $('restart').onclick = () => start(AW.SKIRMISH[0]);
    start(AW.SKIRMISH[0]);
  }

  AW.ui = { init, start, get state() { return S.state; } };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
})(globalThis);
