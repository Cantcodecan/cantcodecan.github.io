// Smoke-Test im Browser. Aufruf: node game/test/smoke.js
const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
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
  await page.click('#end');
  assert.match(await page.textContent('#who'), /Karmin/);

  // Rundenspiel bis zur HQ-Einnahme auf Mini-Karte
  await page.evaluate(() => AW.ui.start({
    map: ['A....B'], units: [['inf', 0, 5, 0], ['inf', 1, 0, 0]], co: ['mira', 'varek'], funds: [0, 0], objective: { type: 'rout' },
  }));
  for (let i = 0; i < 2; i++) {
    await page.click('.tile[data-x="5"][data-y="0"]');          // Einheit wählen
    await page.click('.tile[data-x="5"][data-y="0"]');          // Stehen bleiben
    await page.getByRole('button', { name: 'Einnehmen' }).click();
    if (i === 0) { await page.click('#end'); await page.click('#end'); }  // Karmin, zurück zu Azur
  }
  assert(await page.evaluate(() => AW.ui.state.winner === 0), 'Azur gewinnt durch HQ-Einnahme');
  assert(await page.isVisible('#overlay.show'), 'Sieger-Bildschirm');

  assert.deepStrictEqual(errors, [], 'Konsolenfehler: ' + errors.join('; '));
  await browser.close();
  console.log('smoke ok');
})().catch((e) => { console.error(e); process.exit(1); });
