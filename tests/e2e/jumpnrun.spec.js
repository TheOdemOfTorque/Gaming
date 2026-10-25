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

test.describe('Lumo: Energie und Leben', () => {
  test('HUD zeigt 3 Leben und 3 Energie oben links', async ({ page }) => {
    await page.goto(URL1);
    await expect(page.locator('#leben span')).toHaveCount(3);
    await expect(page.locator('#leben span.weg')).toHaveCount(0);
    await expect(page.locator('#energie i')).toHaveCount(3);
    await expect(page.locator('#energie i.leer')).toHaveCount(0);
    const box = await page.locator('#vital').boundingBox();
    expect(box.y).toBeLessThan(40);
    expect(box.x).toBeLessThan(60);
    const s = await state(page);
    expect(s).toMatchObject({ leben: 3, energie: 3 });
  });

  test('Sturz kostet ein Leben, HUD zieht nach, Energie wieder voll', async ({ page }) => {
    await page.goto(URL1);
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__jnr.debugSet({ energie: 1 }); window.__jnr.debugFall(); });
    await expect(page.locator('#leben span.weg')).toHaveCount(1);
    await expect(page.locator('#energie i.leer')).toHaveCount(0);
    const s = await state(page);
    expect(s).toMatchObject({ mode: 'play', leben: 2, energie: 3 });
  });

  test('alle Leben weg: Game-Over mit Stand, „Nochmal“ startet neu, „Zum Menü“ geht ins Menü', async ({ page }) => {
    await page.goto(URL1);
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__jnr.debugSet({ leben: 1, funken: 4 }); window.__jnr.debugFall(); });
    await expect(page.locator('#msg')).toBeVisible();
    await expect(page.locator('#msg-title')).toHaveText('Alle Leben verbraucht');
    await expect(page.locator('#msg-body')).toContainText('3 Funken'); // der Sturz kostet einen Funken
    await expect(page.locator('#msg-body')).toContainText('Kristallen gesammelt');
    expect((await state(page)).mode).toBe('lost');
    await page.getByRole('button', { name: 'Nochmal' }).click();
    await expect(page.locator('#msg')).toBeHidden();
    expect(await state(page)).toMatchObject({ mode: 'play', leben: 3, energie: 3, funken: 0 });

    await page.evaluate(() => { window.__jnr.debugSet({ leben: 1 }); window.__jnr.debugFall(); });
    await page.getByRole('button', { name: 'Zum Menü' }).click();
    await expect(page.locator('#menu')).toBeVisible();
    expect((await state(page)).mode).toBe('menu');
  });

  test('Hilfe im Menü erklärt Energie und Leben', async ({ page }) => {
    await page.goto('/jumpnrun/index.html');
    await page.click('#btn-hilfe');
    await expect(page.locator('#msg-body')).toContainText('Energie');
    await expect(page.locator('#msg-body')).toContainText('Leben');
    await expect(page.locator('#msg-body')).toContainText('Schlucht');
    await page.getByRole('button', { name: 'Verstanden' }).click();
    await expect(page.locator('#msg')).toBeHidden();
    await expect(page.locator('#menu')).toBeVisible();
  });

  test('Eingebettet: verlorener Lauf sendet kein jnr:result', async ({ page }) => {
    await page.route('**/jumpnrun-harness.html', route => route.fulfill({
      contentType: 'text/html',
      body: '<!DOCTYPE html><html><body><script>window.__got=[];addEventListener("message",e=>window.__got.push(e.data));</script>' +
        '<iframe id="f" src="/jumpnrun/index.html?jnrSeed=1"></iframe></body></html>'
    }));
    await page.goto('/jumpnrun-harness.html');
    const fw = () => page.evaluate(fn => document.getElementById('f').contentWindow.__jnr[fn](), 'state');
    await page.waitForFunction(() => document.getElementById('f').contentWindow.__jnr);
    await page.evaluate(() => document.getElementById('f').contentWindow.postMessage({ type: 'jnr:init', level: '1-1', jnr: {} }, location.origin));
    await page.waitForTimeout(200);
    expect((await fw()).mode).toBe('play');
    await page.evaluate(() => { const j = document.getElementById('f').contentWindow.__jnr; j.debugSet({ leben: 1 }); j.debugFall(); });
    await page.waitForTimeout(1200);
    expect((await fw()).mode).toBe('lost');
    const got = await page.evaluate(() => window.__got);
    expect(got.filter(m => m && m.type === 'jnr:result')).toEqual([]);
  });
});
