// Menüs, Kampagne, Dialoge, Kurzregeln. Steuert nur Bildschirme, Regeln liegen in rules.js
(function (g) {
  const AW = (g.AW = g.AW || {});
  const $ = (id) => document.getElementById(id);
  const SAVE = 'miniwars.campaign', OLD_SAVE = 'eisenfront.campaign';
  const LEVEL_DESC = {
    easy: 'Zögerlich, baut wenig. Guter Einstieg.',
    normal: 'Solide Taktik, nimmt Gebäude ein.',
    hard: 'Plant voraus, nutzt Kräfte und Deckung.',
    brutal: 'Sucht Zugfolgen mit Vorausschau.',
  };
  const STARTS = [0, 2000, 5000, 10000];

  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const levelDesc = (k) => {
    const d = AW.DIFFICULTY[k], bonus = Math.round((d.incomeMul - 1) * 100);
    return `${LEVEL_DESC[k] || ''}${bonus ? ` +${bonus} % Einkommen.` : ''}`;
  };

  // Fortschritt: Anzahl freigeschalteter Missionen (mind. 1)
  function unlocked() {
    try { return Math.max(1, Math.min(AW.MISSIONS.length, Math.max(+localStorage.getItem(SAVE) || 1, +localStorage.getItem(OLD_SAVE) || 1))); } catch (e) { return 1; }
  }
  function unlock(n) {
    try { if (n > unlocked()) localStorage.setItem(SAVE, String(n)); } catch (e) { /* ohne Speicher spielbar */ }
  }

  function show(html, onMount) {
    const el = $('screen');
    el.innerHTML = `<div class="page">${html}</div>`;
    el.classList.add('show');
    if (onMount) onMount(el);
  }
  function hide() { $('screen').classList.remove('show'); $('screen').innerHTML = ''; }
  const back = (label, fn) => ({ label, fn, ghost: true });

  function buttons(items) {
    return items.map((b, i) => `<button data-i="${i}" class="${b.ghost ? 'ghost' : ''}"${b.disabled ? ' disabled' : ''}>${b.label}</button>`).join('');
  }
  function bind(el, items, sel = 'button[data-i]') {
    el.querySelectorAll(sel).forEach((b) => { b.onclick = () => items[+b.dataset.i].fn(); });
  }

  function main() {
    const items = [
      { label: 'Kampagne', fn: campaign },
      { label: 'Gefecht', fn: () => skirmish(false) },
      { label: 'Hot-Seat', fn: () => skirmish(true) },
      { label: 'Regeln', fn: rules },
    ];
    show(`<h1>Miniwars</h1><p class="sub">Die Valdur-Krise</p><div class="list">${buttons(items)}</div>`, (el) => bind(el, items));
  }

  function campaign() {
    const open = unlocked();
    const items = AW.MISSIONS.map((m, i) => ({
      label: `<span>${i + 1}. ${esc(m.name)}</span><span>${i < open ? '' : '🔒'}</span>`,
      disabled: i >= open, fn: () => difficulty(i),
    }));
    items.push(back('Zurück', main));
    show(`<h2>Kampagne</h2><div class="list rows">${buttons(items)}</div>`, (el) => bind(el, items));
  }

  function difficulty(i) {
    const keys = Object.keys(AW.DIFFICULTY);
    const items = keys.map((k) => ({ label: `<span>${AW.DIFFICULTY[k].name}</span><small>${esc(levelDesc(k))}</small>`, fn: () => startMission(i, k) }));
    items.push(back('Zurück', campaign));
    show(`<h2>Schwierigkeit</h2><p class="sub">${esc(AW.MISSIONS[i].name)}</p><div class="list rows two">${buttons(items)}</div>`, (el) => bind(el, items));
  }

  // Dialogzeilen [Sprecher, Text] mit Porträt nacheinander zeigen, dann done()
  function dialog(lines, done) {
    let n = 0;
    const coId = (name) => Object.keys(AW.COMMANDERS).find((k) => AW.COMMANDERS[k].name === name);
    const step = () => {
      if (n >= lines.length) return done();
      const [who, text] = lines[n++], id = coId(who);
      show(`<div class="dialog">${id ? `<div class="pic"><svg viewBox="0 0 64 64">${AW.icons.portrait(id)}</svg></div>` : ''}
        <div><b>${esc(who)}</b><p>${esc(text)}</p></div></div><div class="list"><button id="next">Weiter</button></div>`, (el) => { el.querySelector('#next').onclick = step; });
    };
    step();
  }

  function startMission(i, level) {
    const m = AW.MISSIONS[i];
    dialog(m.intro || [], () => {
      hide();
      AW.ui.start(m, {
        co: m.co, ai: [null, level], difficulty: level,
        onWin: (w) => { if (w === 0) unlock(i + 2); },
        next: (w) => {
          if (w !== 0) return startMission(i, level);
          dialog(m.outro || [], campaign);
        },
        label: { win: i + 1 < AW.MISSIONS.length ? 'Weiter' : 'Fertig', lose: 'Wiederholen' },
      });
    });
  }

  function select(id, label, options, value) {
    return `<label>${label}<select id="${id}">${options.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  }

  function skirmish(hot) {
    const maps = AW.MISSIONS.concat(AW.SKIRMISH);
    const coOpts = (f) => Object.keys(AW.COMMANDERS).map((k) => [k, AW.COMMANDERS[k].name]);
    const lvl = [['', 'Mensch']].concat(Object.keys(AW.DIFFICULTY).map((k) => [k, 'KI ' + AW.DIFFICULTY[k].name]));
    show(`<h2>${hot ? 'Hot-Seat' : 'Gefecht'}</h2><div class="form">
      ${select('fMap', 'Karte', maps.map((m, i) => [i, m.name]), AW.MISSIONS.length)}
      ${select('fCo0', 'CO Azur-Bund', coOpts(), 'mira')}
      ${select('fCo1', 'CO Karmin-Hegemonie', coOpts(), 'varek')}
      ${hot ? '' : select('fAi', 'Karmin gesteuert von', lvl.slice(1), 'normal')}
      ${select('fFunds', 'Startgeld', STARTS.map((v) => [v, String(v)]), 5000)}
    </div><div class="list"><button id="go">Start</button><button id="bk" class="ghost">Zurück</button></div>`, (el) => {
      el.querySelector('#bk').onclick = main;
      el.querySelector('#go').onclick = () => {
        const v = (id) => el.querySelector('#' + id).value;
        const base = maps[+v('fMap')], funds = +v('fFunds');
        const level = hot ? null : v('fAi');
        const def = Object.assign({}, base, { objective: { type: 'rout' } });
        const co = [v('fCo0'), v('fCo1')];
        hide();
        AW.ui.start(def, {
          co, ai: [null, level], difficulty: level || 'normal', funds: [funds, funds],
          next: () => skirmish(hot), label: { win: 'Neues Gefecht', lose: 'Neues Gefecht' },
        });
      };
    });
  }

  // Schadensübersicht: Farbskala nach Basisschaden
  function damageTable() {
    const types = Object.keys(AW.UNITS);
    const head = types.map((t) => `<th title="${esc(AW.UNITS[t].name)}">${esc(AW.UNITS[t].name.slice(0, 3))}</th>`).join('');
    const rows = types.map((a) => `<tr><th title="${esc(AW.UNITS[a].name)}">${esc(AW.UNITS[a].name)}</th>${types.map((d) => {
      const v = AW.DAMAGE[a][d];
      return v === undefined ? '<td class="none">–</td>' : `<td style="background:rgba(${v >= 100 ? '200,40,40' : v >= 50 ? '230,120,40' : '90,140,220'},${(0.15 + Math.min(v, 110) / 110 * 0.6).toFixed(2)})">${v}</td>`;
    }).join('')}</tr>`).join('');
    return `<div class="scroll"><table class="dmg"><tr><th>Angriff ↓ / Ziel →</th>${head}</tr>${rows}</table></div>`;
  }

  function rules() {
    const E = AW.ECONOMY;
    show(`<h2>Kurzregeln</h2><div class="text">
      <p><b>Ablauf:</b> Ein Tag = Zug Azur + Zug Karmin. Jede Einheit bewegt sich und handelt einmal: Angreifen, Einnehmen oder Warten.</p>
      <p><b>Kampf:</b> Schaden = Basiswert × Angreifer-HP × Verteidigung des Geländes. Kein Zufall. Der Überlebende schlägt zurück. Indirekte Einheiten (Artillerie, Raketen) feuern nicht nach einer Bewegung und werden nicht beantwortet.</p>
      <p><b>Wirtschaft:</b> Jedes Gebäude bringt ${E.incomePerProperty} Geld pro Tag. Einnehmen senkt die Punkte (${E.capturePoints}) um die HP der Einheit. Fabriken bauen Bodeneinheiten, Flughäfen Lufteinheiten. Gebäude heilen.</p>
      <p><b>Kraft:</b> Kämpfe laden die Leiste. Ist sie voll, aktiviert der Kommandant seine Kraft bis Zugende.</p>
      <p><b>Sieg:</b> Gegnerisches HQ einnehmen oder alle Einheiten besiegen. Manche Missionen verlangen Durchhalten. Nach Tag ${E.dayLimit} gewinnt, wer mehr Gebäude hält.</p>
      <p><b>Steuerung:</b> Einheit antippen, Feld wählen, Aktion wählen. Rechtsklick oder Escape bricht ab.</p></div>
      <h3>Schaden in % (Basiswert)</h3>${damageTable()}
      <div class="list"><button id="bk" class="ghost">Zurück</button></div>`, (el) => { el.querySelector('#bk').onclick = main; });
  }

  AW.menu = { main, campaign, rules, hide, unlock, unlocked };
})(globalThis);
