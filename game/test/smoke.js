// Smoke-Test im Browser. Aufruf: node game/test/smoke.js
const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const end = async () => { await page.click('#end'); if (/Wirklich/.test(await page.textContent('#end'))) await page.click('#end'); };
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  // Hauptmenü → Gefecht (Hot-Seat)
  await page.waitForSelector('#screen.show');
  assert.strictEqual(await page.title(), 'Old School Wars');
  assert.strictEqual((await page.textContent('#screen h1')).trim(), 'Old School Wars');
  await page.getByRole('button', { name: 'Hot-Seat' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForSelector('.unit');

  // Einheit wählen, Feld wählen, Warten
  await page.click('.unit[data-owner="0"] >> nth=0', { force: true });
  await page.waitForSelector('.tile.reach');
  const n = await page.locator('.tile.reach').count();
  assert(n > 1, 'Reichweite angezeigt');
  const target = page.locator('.tile.reach >> nth=' + (n - 1));
  await target.click();
  await page.getByRole('button', { name: 'Warten' }).click();
  await page.waitForSelector('.unit.done');

  // Zug beenden
  await end();
  assert.match(await page.textContent('#who'), /Karmin/);

  // Rundenspiel bis zur HQ-Einnahme auf Mini-Karte
  await page.evaluate(() => AW.ui.start({
    map: ['A....B'], units: [['inf', 0, 5, 0], ['inf', 1, 0, 0]], co: ['mira', 'varek'], funds: [0, 0], objective: { type: 'rout' },
  }));
  for (let i = 0; i < 2; i++) {
    await page.click('.tile[data-x="5"][data-y="0"]');          // Einheit wählen
    await page.click('.tile[data-x="5"][data-y="0"]');          // Stehen bleiben
    await page.getByRole('button', { name: 'Einnehmen' }).click();
    if (i === 0) { await end(); await end(); }  // Karmin, zurück zu Azur
  }
  assert(await page.evaluate(() => AW.ui.state.winner === 0), 'Azur gewinnt durch HQ-Einnahme');
  assert(await page.isVisible('#overlay.show'), 'Sieger-Bildschirm');

  // Kampagne: M1 starten, Dialog durchklicken, gewinnen, M2 freigeschaltet
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.click('#toMenu');
  await page.getByRole('button', { name: 'Kampagne' }).click();
  assert(await page.getByRole('button', { name: /2\. Der Wald/ }).isDisabled(), 'M2 gesperrt');
  await page.getByRole('button', { name: /1\. Landung/ }).click();
  assert.match(await page.textContent('#screen'), /\+10 % Einkommen/, 'Beschreibung Sehr schwer');
  await page.getByRole('button', { name: /Mittel/ }).click();
  while (await page.isVisible('#screen.show')) await page.click('#next');
  assert.match(await page.textContent('#goal'), /HQ/);
  await page.evaluate(() => { const s = AW.ui.state; s.units = s.units.filter((u) => u.owner === 0); s.day = 2; });
  await end();
  await end().catch(() => {});
  await page.waitForSelector('#overlay.show');
  assert(await page.evaluate(() => AW.menu.unlocked() === 2), 'M2 freigeschaltet');
  await page.click('#restart');
  while (await page.isVisible('#screen.show') && await page.locator('#next').count()) await page.click('#next');
  assert(await page.getByRole('button', { name: /2\. Der Wald/ }).isEnabled(), 'M2 offen');

  // Regeln-Seite
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('button', { name: 'Regeln' }).click();
  assert(await page.locator('table.dmg td').count() > 50, 'Schadenstabelle');

  // Mobil 360×740 und Desktop: Screenshots, kein horizontales Seitenscrollen
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('button', { name: 'Hot-Seat' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForSelector('.unit');
  const shots = path.resolve(__dirname, 'shots');
  require('fs').mkdirSync(shots, { recursive: true });
  for (const [w, h] of [[360, 740], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Seitenscroll bei ' + w);
    await page.screenshot({ path: path.join(shots, `${w}x${h}.png`) });
  }
  // Rückgängig + Bestätigung vor Zugende
  await page.click('.unit[data-owner="0"] >> nth=0', { force: true });
  await page.locator('.tile.reach >> nth=-1').click();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  assert.strictEqual(await page.locator('.unit.done').count(), 0, 'Rückgängig lässt Einheit frei');
  await page.click('#end');
  assert.match(await page.textContent('#end'), /Wirklich/, 'Bestätigung');

  assert.deepStrictEqual(errors, [], 'Konsolenfehler: ' + errors.join('; '));
  await browser.close();
  console.log('smoke ok');
})().catch((e) => { console.error(e); process.exit(1); });
