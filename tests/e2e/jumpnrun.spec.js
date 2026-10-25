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

  test('Game-Over per Tastatur: Fokus auf „Nochmal“, Esc geht ins Menü, Enter spielt nochmal', async ({ page }) => {
    await page.goto(URL1);
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__jnr.debugSet({ leben: 1 }); window.__jnr.debugFall(); });
    await expect(page.locator('#msg-title')).toHaveText('Alle Leben verbraucht');
    await expect(page.getByRole('button', { name: 'Nochmal' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu')).toBeVisible();
    expect((await state(page)).mode).toBe('menu');

    await page.click('button[data-level="1-1"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__jnr.debugSet({ leben: 1 }); window.__jnr.debugFall(); });
    await expect(page.locator('#msg')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nochmal' })).toBeFocused();
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Enter');
    await expect(page.locator('#msg')).toBeHidden();
    expect(await state(page)).toMatchObject({ mode: 'play', leben: 3 });
  });

  test('Lebensverlust wird per Live-Region angesagt, die Leben/Energie-Box selbst ist nicht live', async ({ page }) => {
    await page.goto(URL1);
    await expect(page.locator('#vital')).not.toHaveAttribute('aria-live', /.*/);
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__jnr.debugFall());
    await expect(page.locator('#vital-live')).toContainText('Noch 2 Leben');
    await expect(page.locator('#leben')).toHaveAttribute('aria-label', 'Leben: 2 von 3');
  });

  test('Hinweis zu Leben/Energie: Pause unterbricht ihn, nach „Weiter“ kommt er wieder', async ({ page }) => {
    await page.goto(URL1);
    await expect(page.locator('#tipp')).toBeVisible();
    await page.click('#btn-pause');
    await expect(page.locator('#tipp')).toBeHidden();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.locator('#tipp')).toBeVisible();
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

// ---------- Review-Nachbesserungen Reihenwahl ----------
test('Zielansage passt im Hochformat 390 px ganz ins Bild', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL2 + '&jnrReihe=7');
  const intro = page.locator('#ziel-intro');
  await expect(intro).toBeVisible();
  const b = await intro.boundingBox();
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(390);
  // Text ist nicht abgeschnitten: Inhalt nicht breiter als die Box
  const overflow = await intro.evaluate(el => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Ziffern: 1 wählt nichts, 0 die 10er-Reihe, Ziffernblock geht auch', async ({ page }) => {
  await page.goto(URL2);
  await expect(page.locator('#reihenwahl')).toBeVisible();
  await page.keyboard.press('Digit1');
  await expect(page.locator('#rw-grid .rw.sel')).toHaveAttribute('data-reihe', '2');
  await page.keyboard.press('Numpad5');
  await expect(page.locator('#rw-grid .rw.sel')).toHaveAttribute('data-reihe', '5');
  await page.keyboard.press('Digit0');
  await expect(page.locator('#rw-grid .rw.sel')).toHaveAttribute('data-reihe', '10');
});

test('Zähler im Ziel-Chip wird nicht live vorgelesen, Dialog ist modal', async ({ page }) => {
  await page.goto(URL2);
  await expect(page.locator('#reihenwahl .card')).toHaveAttribute('aria-modal', 'true');
  await page.locator('#rw-grid .rw[data-reihe="7"]').click();
  await expect(page.locator('#ziel')).not.toHaveAttribute('role', /status|alert/);
  await expect(page.locator('#ziel')).not.toHaveAttribute('aria-live', /.+/);
  await expect(page.locator('#ziel-live')).toHaveText('Sammle die 7er-Reihe');
});

test('Die 100 der 10er-Reihe passt in ihren Kristall (schmale Ziffern)', async ({ page }) => {
  await page.goto('/jumpnrun/index.html?jnrLevel=1-2&jnrSeed=3&jnrReihe=10');
  const cr = await page.evaluate(() => window.__jnr.crystals());
  expect(cr.filter(c => !c.good).every(c => c.value <= 99)).toBe(true);
  expect(cr.some(c => c.value === 100)).toBe(true);
});

const harness = (page) => page.route('**/jumpnrun-harness.html', route => route.fulfill({
  contentType: 'text/html',
  body: '<!DOCTYPE html><html><body><iframe id="f" style="width:844px;height:390px" src="/jumpnrun/index.html?jnrSeed=1"></iframe></body></html>'
}));
const sendTo = (page, m) => page.evaluate(msg => document.getElementById('f').contentWindow.postMessage(msg, location.origin), m);
const INIT12 = { type: 'jnr:init', level: '1-2', jnr: { levels: { '1-1': { medals: 2, bestTimeMs: 1, bestFunken: 1 } } }, lernstand: { 7: 0.3, 9: 0.45 } };

test('Neustart wählt die gerade gespielte Reihe vor, nicht die Empfehlung', async ({ page }) => {
  await harness(page);
  await page.goto('/jumpnrun-harness.html');
  const frame = page.frameLocator('#f');
  await expect(frame.locator('#menu')).toBeVisible();
  await sendTo(page, INIT12);
  await frame.locator('#rw-grid .rw[data-reihe="4"]').click();
  await expect(frame.locator('#ziel .z-reihe')).toHaveText('4er-Reihe');
  await frame.locator('#btn-pause').click();
  await frame.getByRole('button', { name: 'Level neu starten' }).click();
  await expect(frame.locator('#reihenwahl')).toBeVisible();
  await expect(frame.locator('#rw-grid .rw.sel')).toHaveAttribute('data-reihe', '4');
});

test('Nochmal nach dem Ziel wählt die gerade gespielte Reihe vor', async ({ page }) => {
  await harness(page);
  await page.goto('/jumpnrun-harness.html');
  const frame = page.frameLocator('#f');
  await expect(frame.locator('#menu')).toBeVisible();
  await sendTo(page, INIT12);
  await frame.locator('#rw-grid .rw[data-reihe="4"]').click();
  // Lumo direkt vor den Leuchtturm setzen
  await page.evaluate(() => {
    const w = document.getElementById('f').contentWindow;
    w.__jnr.teleport(w.__jnr.goal().tx, w.__jnr.goal().ty - 1);
  });
  await frame.locator('#msg').getByRole('button', { name: 'Nochmal' }).click({ timeout: 5000 });
  await expect(frame.locator('#reihenwahl')).toBeVisible();
  await expect(frame.locator('#rw-grid .rw.sel')).toHaveAttribute('data-reihe', '4');
});

test('Spielzeit-Ende während der Reihenwahl blendet die Auswahl aus', async ({ page }) => {
  await harness(page);
  await page.goto('/jumpnrun-harness.html');
  const frame = page.frameLocator('#f');
  await expect(frame.locator('#menu')).toBeVisible();
  await sendTo(page, INIT12);
  await expect(frame.locator('#reihenwahl')).toBeVisible();
  await sendTo(page, { type: 'jnr:timeup' });
  await expect(frame.locator('#reihenwahl')).toBeHidden();
  await expect(frame.locator('#msg')).toContainText('Spielzeit vorbei');
});

// ---------- Rechenwicht (Spec "Lumo Leben, Gegner und Reihenwahl", Abschnitt 3 und 5) ----------
test.describe('Lumo: Rechenwicht', () => {
  const URLW = '/jumpnrun/index.html?jnrLevel=1-2&jnrSeed=1&jnrReihe=7';

  test('Hilfe erklärt den Rechenwicht (draufspringen, Seite kostet Energie)', async ({ page }) => {
    await page.goto('/jumpnrun/index.html');
    await page.click('#btn-hilfe');
    await expect(page.locator('#msg-body')).toContainText('Rechenwicht');
    await expect(page.locator('#msg-body')).toContainText('von oben');
    await expect(page.locator('#msg-body')).toContainText('von der Seite');
  });

  test('Stufe 1-2: Wichte tragen eine falsche Rechnung aus der gewählten Reihe', async ({ page }) => {
    await page.goto(URLW);
    const list = await page.evaluate(() => window.__jnr.enemies());
    expect(list.length).toBeGreaterThan(0);
    list.forEach(e => {
      expect(e.state).toBe('da');
      expect(e.falsch).toMatch(/^\d+×7=\d+$/);
      expect(e.richtig).toMatch(/^\d+×7=\d+$/);
      expect(e.falsch).not.toBe(e.richtig);
    });
    expect((await state(page)).level).toBe('1-2');
  });

  test('Draufspringen: Tafel deckt auf, Funke, keine Energie verloren', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URLW);
    await page.waitForTimeout(200);
    const i = await page.evaluate(() => { const i = 0; window.__jnr.debugFreiUmWicht(i, 4); window.__jnr.debugAmWicht(i, 1, -16); return i; });
    await expect.poll(() => page.evaluate(k => window.__jnr.enemies()[k].state, i)).toBe('aufgedeckt');
    const s = await state(page);
    expect(s.funken).toBe(1);
    expect(s.energie).toBe(3);
    expect(s.fehltreffer).toBe(0);
    await expect(page.locator('#funken')).toHaveText('✦ 1');
    await expect.poll(() => page.evaluate(k => window.__jnr.enemies()[k].state, i), { timeout: 4000 }).toBe('weg');
    expect(errors).toEqual([]);
  });

  test('Von der Seite: 1 Energie weg, Wicht bleibt', async ({ page }) => {
    await page.goto(URLW);
    await page.waitForTimeout(200);
    const i = await page.evaluate(() => { const i = 0; window.__jnr.debugFreiUmWicht(i, 4); window.__jnr.debugAmWicht(i, -6, 4); return i; });
    await expect(page.locator('#energie i.leer')).toHaveCount(1);
    const s = await state(page);
    expect(s.energie).toBe(2);
    expect(s.fehltreffer).toBe(1);
    expect(await page.evaluate(k => window.__jnr.enemies()[k].state, i)).toBe('da');
  });
});
