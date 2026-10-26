// Spielfeld zeichnen und animieren. Zeichnet nur, enthält keine Regeln. Vorgaben: docs/ART.md
(function (g) {
  const AW = (g.AW = g.AW || {});
  const STEP_MS = 60;
  let fast = false;
  let root, tilesEl, unitsEl;

  const key = (x, y) => x + ',' + y;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const dispHp = (hp) => Math.ceil(hp / 10);

  // Bits: oben 1, rechts 2, unten 4, links 8; Fluss zusätzlich Diagonalen 16/32/64/128
  function neighborMask(s, x, y, terrain) {
    const joins = {
      road: (t) => t === 'road' || !!AW.TERRAIN[t].property,
      river: (t) => t === 'river' || t === 'sea',
    }[terrain];
    if (!joins) return 0;
    let m = 0;
    [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]].forEach(([dx, dy, bit]) => {
      const t = s.tiles[(y + dy) * s.w + x + dx];
      if (x + dx >= 0 && x + dx < s.w && y + dy >= 0 && y + dy < s.h && t && joins(t.terrain)) m |= bit;
    });
    if (terrain === 'river') {
      const at = (dx, dy) => { const t = s.tiles[(y + dy) * s.w + x + dx]; return x + dx >= 0 && x + dx < s.w && y + dy >= 0 && y + dy < s.h && !!t && joins(t.terrain); };
      // Diagonal-Bits: oben-rechts 16, unten-rechts 32, unten-links 64, oben-links 128
      [[1, -1, 16, 2, 1], [1, 1, 32, 2, 4], [-1, 1, 64, 8, 4], [-1, -1, 128, 8, 1]].forEach(([dx, dy, bit, a, b]) => {
        if ((m & a) && (m & b) && at(dx, dy)) m |= bit;
      });
    }
    return m;
  }

  function init(el) {
    root = el;
    root.innerHTML = '<div id="tiles"></div><div id="units"></div>';
    tilesEl = root.querySelector('#tiles');
    unitsEl = root.querySelector('#units');
  }

  // view: { reach:Set, atk:Set, path:Set, sel:'x,y', override:{id,x,y} }
  function draw(s, view = {}) {
    root.style.setProperty('--w', s.w);
    root.style.setProperty('--h', s.h);
    let th = '';
    s.tiles.forEach((t, i) => {
      const x = i % s.w, y = Math.floor(i / s.w), k = key(x, y);
      const cls = ['tile'];
      if (view.reach && view.reach.has(k)) cls.push('reach');
      if (view.atk && view.atk.has(k)) cls.push('atk');
      if (view.path && view.path.has(k)) cls.push('path');
      if (view.sel === k) cls.push('sel');
      const cp = t.cp < AW.ECONOMY.capturePoints ? `<span class="cp">${t.cp}</span>` : '';
      th += `<div class="${cls.join(' ')}" data-x="${x}" data-y="${y}"><svg viewBox="0 0 48 48">${AW.icons.terrain(t.terrain, t.owner, x, y, neighborMask(s, x, y, t.terrain))}</svg>${cp}</div>`;
    });
    tilesEl.innerHTML = th;
    let uh = '';
    for (const u of s.units) {
      const o = view.override && view.override.id === u.id ? view.override : u;
      const done = u.acted && u.owner === s.turn;
      const hp = u.hp < 100 ? `<span class="hp">${dispHp(u.hp)}</span>` : '';
      uh += `<div class="unit${done ? ' done' : ''}" data-id="${u.id}" data-owner="${u.owner}" style="--x:${o.x};--y:${o.y}"><svg viewBox="0 0 48 48">${AW.icons.unit(u.type, u.owner)}</svg>${hp}</div>`;
    }
    unitsEl.innerHTML = uh;
  }

  const unitEl = (id) => unitsEl.querySelector(`.unit[data-id="${id}"]`);

  // path: [{x,y}, …] inklusive Start
  async function moveUnit(id, path) {
    const el = unitEl(id);
    if (!el) return;
    for (const p of path.slice(1)) {
      el.style.setProperty('--x', p.x);
      el.style.setProperty('--y', p.y);
      await wait(fast ? 15 : STEP_MS);
    }
  }

  async function flash(id) {
    const el = unitEl(id);
    if (!el) return;
    el.classList.add('flash');
    await wait(fast ? 40 : 150);
    el.classList.remove('flash');
  }

  function floatText(x, y, text, cls = '') {
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.textContent = text;
    el.style.left = `calc(var(--t) * ${x})`;
    el.style.top = `calc(var(--t) * ${y})`;
    unitsEl.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  AW.render = { init, draw, neighborMask, setFast: (f) => { fast = !!f; }, moveUnit, flash, floatText, wait };
  if (typeof module !== 'undefined' && module.exports) module.exports = AW.render;
})(globalThis);
