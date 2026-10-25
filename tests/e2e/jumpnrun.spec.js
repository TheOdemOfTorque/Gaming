const { test, expect } = require('@playwright/test');

// iPhone im Querformat (Chromium-Emulation: Touch, Retina, mobile Viewport)
test.use({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

const URL1 = '/jumpnrun/index.html?jnrLevel=1-1&jnrSeed=1';
const state = page => page.evaluate(() => window.__jnr.state());

test('Seite lädt, Canvas ist sichtbar und gezeichnet', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL1);
  const canvas = page.locator('#c');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  // Die Welt fuellt die Bildschirmbreite (Viewport-Fix), Resthoehe unter 144/dpr CSS-px.
  expect(box.width).toBeGreaterThanOrEqual(844 - 1);
  expect(390 - box.height).toBeLessThan(144 / 3);
  // Es müssen mehrere verschiedene Farben im Bild sein (nicht leer)
  await page.waitForTimeout(300);
  const colors = await page.evaluate(() => {
    const c = document.getElementById('c');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const set = new Set();
    for (let i = 0; i < d.length; i += 4) set.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return set.size;
  });
  expect(colors).toBeGreaterThan(8);
  expect(errors).toEqual([]);
});

test('Debug-Parameter startet Level 1-1 ohne Menü', async ({ page }) => {
  await page.goto(URL1);
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#btn-jump')).toBeVisible();
  await expect(page.locator('#btn-pause')).toBeVisible();
  const s = await state(page);
  expect(s.level).toBe('1-1');
  expect(s.mode).toBe('play');
  await expect(page.locator('#ziel')).toHaveText('Sammle alle Funken');
});

test('Ohne Parameter erscheint das Menü mit Level 1-1 offen und 1-2 gesperrt', async ({ page }) => {
  await page.goto('/jumpnrun/index.html');
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('button[data-level="1-1"]')).toBeEnabled();
  await expect(page.locator('button[data-level="1-2"]')).toBeDisabled();
  await page.click('button[data-level="1-1"]');
  await expect(page.locator('#menu')).toBeHidden();
  expect((await state(page)).mode).toBe('play');
});

test('Tastatur: Pfeil rechts bewegt Lumo, Leertaste lässt ihn springen', async ({ page }) => {
  await page.goto(URL1);
  await page.waitForTimeout(300); // Lumo landet auf dem Boden
  const s0 = await state(page);
  expect(s0.onGround).toBe(true);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  const s1 = await state(page);
  expect(s1.x).toBeGreaterThan(s0.x + 20);
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  const s2 = await state(page);
  expect(s2.y).toBeLessThan(s1.y - 4);
  expect(s2.onGround).toBe(false);
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
});

test('Touch: rechter Daumen springt, linker läuft (Multitouch über Pointer Events)', async ({ page }) => {
  await page.goto(URL1);
  await page.waitForTimeout(300);
  const s0 = await state(page);
  // Pointer-Events direkt auslösen (zwei Finger gleichzeitig)
  await page.evaluate(() => {
    const fire = (el, type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    const r = document.getElementById('btn-right').getBoundingClientRect();
    const j = document.getElementById('zone-right').getBoundingClientRect();
    window.__fire = () => {
      fire(document.getElementById('zone-left'), 'pointerdown', 11, r.left + r.width / 2, r.top + 20);
      fire(document.getElementById('zone-right'), 'pointerdown', 12, j.left + 40, j.top + 40);
    };
    window.__fire();
  });
  await page.waitForTimeout(200);
  const s1 = await state(page);
  expect(s1.x).toBeGreaterThan(s0.x + 5);
  expect(s1.onGround).toBe(false);
});

test('Hochformat zeigt den Dreh-Hinweis', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL1);
  await expect(page.locator('#portrait-hint')).toBeVisible();
  await expect(page.locator('#portrait-hint')).toContainText('Dreh dein iPhone');
});

test('Direktstart im Hochformat pausiert sofort hinter dem Dreh-Hinweis', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL1);
  await expect(page.locator('#portrait-hint')).toBeVisible();
  const a = await state(page);
  expect(a.mode).toBe('pause');
  await page.waitForTimeout(300);
  const b = await state(page);
  expect(b.t).toBe(a.t);
});

test('Eingebettetes Spiel erholt sich nach jnr:timeup durch ein erneutes jnr:init', async ({ page }) => {
  await page.route('**/jumpnrun-harness.html', route => route.fulfill({
    contentType: 'text/html',
    body: '<!DOCTYPE html><html><body><iframe id="f" src="/jumpnrun/index.html?jnrSeed=1"></iframe></body></html>'
  }));
  await page.goto('/jumpnrun-harness.html');
  const frameState = () => page.evaluate(() => document.getElementById('f').contentWindow.__jnr.state());
  const send = msg => page.evaluate(m => {
    document.getElementById('f').contentWindow.postMessage(m, location.origin);
  }, msg);

  await send({ type: 'jnr:init', level: '1-1', jnr: {} });
  await page.waitForTimeout(200);
  expect((await frameState()).mode).toBe('play');

  await send({ type: 'jnr:timeup' });
  await page.waitForTimeout(100);
  expect((await frameState()).mode).toBe('ended');

  await send({ type: 'jnr:init', level: '1-1', jnr: {} });
  await page.waitForTimeout(200);
  expect((await frameState()).mode).toBe('play');
});

test('Pause stoppt die Simulation', async ({ page }) => {
  await page.goto(URL1);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);
  await page.click('#btn-pause');
  await page.keyboard.up('ArrowRight');
  const a = await state(page);
  expect(a.mode).toBe('pause');
  await page.waitForTimeout(300);
  const b = await state(page);
  expect(b.t).toBe(a.t);
});

// ---------- Reihenwahl + Ziel-Chip (Spec "Lumo Leben, Gegner und Reihenwahl", Abschnitt 2) ----------
const URL2 = '/jumpnrun/index.html?jnrLevel=1-2&jnrSeed=1';

test('Mathe-Stufe zeigt erst die Reihenwahl 2 bis 10, ohne Trainer ohne Empfehlung', async ({ page }) => {
  await page.goto(URL2);
  await expect(page.locator('#reihenwahl')).toBeVisible();
  expect((await state(page)).mode).toBe('reihenwahl');
  const reihen = await page.locator('#rw-grid .rw').evaluateAll(bs => bs.map(b => b.getAttribute('data-reihe')));
  expect(reihen).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', '10']);
  await expect(page.locator('#rw-grid .emp')).toHaveCount(0);
  await expect(page.locator('#rw-grid .rw.sel')).toHaveAttribute('data-reihe', '2');
  // grosse Touch-Ziele
  const box = await page.locator('#rw-grid .rw[data-reihe="7"]').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(48);
  expect(box.width).toBeGreaterThanOrEqual(48);
});

test('Tippen auf eine Reihe startet die Stufe: grosse Zielansage, dann Chip mit Zähler', async ({ page }) => {
  await page.goto(URL2);
  await page.locator('#rw-grid .rw[data-reihe="7"]').click();
  await expect(page.locator('#reihenwahl')).toBeHidden();
  const s = await state(page);
  expect(s.mode).toBe('play');
  expect(s.reihe).toBe(7);
  await expect(page.locator('#ziel-intro')).toBeVisible();
  await expect(page.locator('#ziel-intro')).toHaveText('Sammle die 7er-Reihe');
  await expect(page.locator('#ziel .z-reihe')).toHaveText('7er-Reihe');
  await expect(page.locator('#ziel .z-zahl')).toHaveText(/^0 \/ \d+$/);
  await expect(page.locator('#ziel-intro')).toBeHidden({ timeout: 3500 });
  await expect(page.locator('#ziel')).toBeVisible();
  // Chip sitzt oben mittig
  const vw = page.viewportSize().width;
  const zb = await page.locator('#ziel').boundingBox();
  expect(Math.abs(zb.x + zb.width / 2 - vw / 2)).toBeLessThan(4);
  expect(zb.y).toBeLessThan(40);
});

test('Reihenwahl per Tastatur: Pfeile wählen, Enter startet, Esc geht zurück', async ({ page }) => {
  await page.goto(URL2);
  await expect(page.locator('#reihenwahl')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#rw-grid .rw.sel')).toHaveAttribute('data-reihe', '7');
  await expect(page.locator('#rw-grid .rw[data-reihe="7"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeVisible();

  await page.goto(URL2);
  await page.keyboard.press('Digit9');
  await page.keyboard.press('Enter');
  const s = await state(page);
  expect(s.mode).toBe('play');
  expect(s.reihe).toBe(9);
});

test('Stufe 1-1 und Zahlen-Modus aus kommen ohne Reihenwahl aus', async ({ page }) => {
  await page.goto(URL1);
  expect((await state(page)).mode).toBe('play');
  await expect(page.locator('#reihenwahl')).toBeHidden();
});

test('Eingebettet: Lernstand aus jnr:init markiert die schwächsten Reihen und wählt die schwächste vor', async ({ page }) => {
  await page.route('**/jumpnrun-harness.html', route => route.fulfill({
    contentType: 'text/html',
    body: '<!DOCTYPE html><html><body><iframe id="f" style="width:844px;height:390px" src="/jumpnrun/index.html?jnrSeed=1"></iframe></body></html>'
  }));
  await page.goto('/jumpnrun-harness.html');
  const frame = page.frameLocator('#f');
  await expect(frame.locator('#menu')).toBeVisible();
  await page.evaluate(() => {
    document.getElementById('f').contentWindow.postMessage({
      type: 'jnr:init', level: '1-2', jnr: { levels: { '1-1': { medals: 2, bestTimeMs: 1, bestFunken: 1 } } },
      lernstand: { 2: 0.9, 7: 0.3, 9: 0.45, 5: 1 }
    }, location.origin);
  });
  await expect(frame.locator('#reihenwahl')).toBeVisible();
  const emp = await frame.locator('#rw-grid .rw:has(.emp)').evaluateAll(bs => bs.map(b => b.getAttribute('data-reihe')));
  expect(emp).toEqual(['7', '9']);
  await expect(frame.locator('#rw-grid .rw.sel')).toHaveAttribute('data-reihe', '7');
  await frame.locator('#rw-los').click();
  await expect(frame.locator('#ziel .z-reihe')).toHaveText('7er-Reihe');
});
