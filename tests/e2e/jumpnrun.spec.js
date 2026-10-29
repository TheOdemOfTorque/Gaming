const { test, expect } = require('@playwright/test');

// iPhone im Querformat (Chromium-Emulation: Touch, Retina, mobile Viewport)
test.use({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

// Seit Stufe 1-1 "Erste Schritte" gestrichen ist, ist 1-2 "Zahlenwiese" die erste Stufe. jnrReihe=2
// ueberspringt die Reihenwahl, damit Steuerung, Physik und HUD direkt im Level laufen.
const URL1 = '/jumpnrun/index.html?jnrLevel=1-2&jnrSeed=1&jnrReihe=2';
const state = page => page.evaluate(() => window.__jnr.state());
// Tutorial schon gesehen (sonst startet der erste Menü-Klick das Mitmach-Tutorial)
const tutorialGesehen = page => page.addInitScript(() => localStorage.setItem('henry_jnr', JSON.stringify({ tutorialGesehen: true })));

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

test('Debug-Parameter startet Level 1-2 ohne Menü', async ({ page }) => {
  await page.goto(URL1);
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#btn-jump')).toBeVisible();
  await expect(page.locator('#btn-pause')).toBeVisible();
  const s = await state(page);
  expect(s.level).toBe('1-2');
  expect(s.mode).toBe('play');
  await expect(page.locator('#ziel .z-reihe')).toHaveText('2er-Reihe');
});

test('Ohne Parameter erscheint das Menü: nur die Zahlenwiese, sofort offen, ohne Stufennummer', async ({ page }) => {
  await tutorialGesehen(page);
  await page.goto('/jumpnrun/index.html?jnrDebug=1');
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#levellist button')).toHaveCount(1);
  await expect(page.locator('button[data-level="1-1"]')).toHaveCount(0);
  const b = page.locator('button[data-level="1-2"]');
  await expect(b).toBeEnabled();
  await expect(b).toContainText('Zahlenwiese');
  await expect(b).not.toContainText('1-2');
  await expect(page.locator('#menu')).not.toContainText('Erste Schritte');
  await b.click();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#reihenwahl')).toBeVisible(); // Mathe-Stufe: erst die Reihenwahl
  await expect(page.locator('#rw-sub')).toContainText('Zahlenwiese');
  await expect(page.locator('#rw-sub')).not.toContainText('1-2');
  await page.locator('#rw-los').click();
  expect(await state(page)).toMatchObject({ mode: 'play', level: '1-2' });
});

test('Alter Spielstand mit der gestrichenen Stufe 1-1: kein Fehler, keine Geisterstufe, 1-2 offen', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('henry_jnr', JSON.stringify({
    tutorialGesehen: true, lastLevel: '1-1', funkenTotal: 7,
    levels: { '1-1': { medals: 3, bestTimeMs: 5000, bestFunken: 7 } }, xpAwarded: { '1-1': true }
  })));
  await page.goto('/jumpnrun/index.html?jnrDebug=1');
  await expect(page.locator('#levellist button')).toHaveCount(1);
  await expect(page.locator('button[data-level="1-2"]')).toBeEnabled();
  await expect(page.locator('button[data-level="1-2"] .medals')).toHaveText('☆☆☆');
  expect(errors).toEqual([]);
});

test('Unbekanntes Level im Debug-Parameter (z. B. die gestrichene 1-1) fällt aufs Menü zurück', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await tutorialGesehen(page);
  await page.goto('/jumpnrun/index.html?jnrLevel=1-1&jnrSeed=1');
  await expect(page.locator('#menu')).toBeVisible();
  expect((await state(page)).mode).toBe('menu');
  await page.evaluate(() => window.__jnr.start('1-1')); // auch der direkte Aufruf crasht nicht
  await expect(page.locator('#menu')).toBeVisible();
  expect(errors).toEqual([]);
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

test('Touch-Gerät im Hochformat: bildschirmfüllende Dreh-Anzeige ohne Trotzdem-spielen-Knopf', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL1);
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
  const hint = page.locator('#portrait-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Dreh dein Handy quer');
  await expect(hint).toContainText('Querformat');
  await expect(hint.locator('button')).toHaveCount(0);
  await expect(page.locator('#portrait-ok')).toHaveCount(0);
  const box = await hint.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(390 - 1);
  expect(box.height).toBeGreaterThanOrEqual(844 - 1);
});

test('Touch-Gerät im Hochformat: Dreh-Anzeige auch im Menü und in der Reihenwahl', async ({ page }) => {
  await tutorialGesehen(page);
  await page.goto('/jumpnrun/index.html');
  await expect(page.locator('#menu')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#portrait-hint')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#portrait-hint')).toBeHidden();
  await page.goto('/jumpnrun/index.html?jnrLevel=1-2&jnrSeed=1'); // Mathe-Stufe: erst die Reihenwahl
  await expect(page.locator('#reihenwahl')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#portrait-hint')).toBeVisible();
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
    body: '<!DOCTYPE html><html><body><iframe id="f" src="/jumpnrun/index.html?jnrSeed=1&jnrReihe=2"></iframe></body></html>'
  }));
  await page.goto('/jumpnrun-harness.html');
  const frameState = () => page.evaluate(() => document.getElementById('f').contentWindow.__jnr.state());
  const send = msg => page.evaluate(m => {
    document.getElementById('f').contentWindow.postMessage(m, location.origin);
  }, msg);

  await send({ type: 'jnr:init', level: '1-2', jnr: {} });
  await page.waitForTimeout(200);
  expect((await frameState()).mode).toBe('play');

  await send({ type: 'jnr:timeup' });
  await page.waitForTimeout(100);
  expect((await frameState()).mode).toBe('ended');

  await send({ type: 'jnr:init', level: '1-2', jnr: {} });
  await page.waitForTimeout(200);
  expect((await frameState()).mode).toBe('play');

  // Trainer mit altem Spielstand schickt die gestrichene Stufe: Menü statt Absturz
  await send({ type: 'jnr:timeup' });
  await send({ type: 'jnr:init', level: '1-1', jnr: { lastLevel: '1-1', levels: { '1-1': { medals: 1 } } } });
  await page.waitForTimeout(200);
  expect((await frameState()).mode).toBe('menu');
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

  test('alle Leben weg: Game-Over mit Stand, „Nochmal“ startet sofort dieselbe Reihe neu, „Zum Menü“ geht ins Menü', async ({ page }) => {
    await page.goto(URL1);
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__jnr.debugSet({ leben: 1, funken: 4 }); window.__jnr.debugFall(); });
    await expect(page.locator('#msg')).toBeVisible();
    await expect(page.locator('#msg-title')).toHaveText('Alle Leben verbraucht');
    await expect(page.locator('#msg-body')).toContainText('Lumo ist ganz erschöpft. So weit bist du gekommen:');
    await expect(page.locator('#msg-body')).not.toContainText('Pause'); // "Pause" ist ein eigener Zustand mit "Weiter"
    await expect(page.locator('#msg-body')).toContainText('4 Funken'); // der Sturz kostet keinen Funken
    await expect(page.locator('#msg-body')).toContainText('Kristallen gesammelt');
    expect((await state(page)).mode).toBe('lost');
    await expect(page.locator('#msg-buttons button')).toHaveText(['Nochmal', 'Zum Menü']);
    await page.getByRole('button', { name: 'Nochmal' }).click();
    await expect(page.locator('#msg')).toBeHidden();
    // Mathe-Level: "Nochmal" startet direkt mit derselben Reihe, ohne Reihenwahl (B5)
    await expect(page.locator('#reihenwahl')).toBeHidden();
    await expect(page.locator('#ziel .z-reihe')).toHaveText('2er-Reihe');
    expect(await state(page)).toMatchObject({ mode: 'play', reihe: 2, leben: 3, energie: 3, funken: 0 });

    await page.evaluate(() => { window.__jnr.debugSet({ leben: 1 }); window.__jnr.debugFall(); });
    await page.getByRole('button', { name: 'Zum Menü' }).click();
    await expect(page.locator('#menu')).toBeVisible();
    expect((await state(page)).mode).toBe('menu');
  });

  test('Game-Over per Tastatur: Fokus auf „Nochmal“, Esc und Enter spielen sofort nochmal', async ({ page }) => {
    await tutorialGesehen(page);
    await page.goto(URL1);
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__jnr.debugSet({ leben: 1 }); window.__jnr.debugFall(); });
    await expect(page.locator('#msg-title')).toHaveText('Alle Leben verbraucht');
    await expect(page.getByRole('button', { name: 'Nochmal' })).toBeFocused();
    await page.keyboard.press('Escape'); // Esc loest wie Enter den Hauptknopf aus
    await expect(page.locator('#msg')).toBeHidden();
    await expect(page.locator('#reihenwahl')).toBeHidden();
    expect(await state(page)).toMatchObject({ mode: 'play', leben: 3, reihe: 2 });

    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__jnr.debugSet({ leben: 1 }); window.__jnr.debugFall(); });
    await expect(page.locator('#msg')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nochmal' })).toBeFocused();
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Enter');
    await expect(page.locator('#msg')).toBeHidden();
    await expect(page.locator('#reihenwahl')).toBeHidden(); // kein Zwischenschritt
    expect(await state(page)).toMatchObject({ mode: 'play', leben: 3, reihe: 2 });

    await page.evaluate(() => { window.__jnr.debugSet({ leben: 1 }); window.__jnr.debugFall(); });
    await page.getByRole('button', { name: 'Zum Menü' }).click();
    await expect(page.locator('#menu')).toBeVisible();
    expect((await state(page)).mode).toBe('menu');
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

  test('Hilfe im Menü erklärt Energie und Leben, sagt „Level“ statt „Stufe“, hat Verstanden und Tutorial', async ({ page }) => {
    await page.goto('/jumpnrun/index.html?jnrDebug=1');
    await page.click('#btn-hilfe');
    await expect(page.locator('#msg-body')).toContainText('Energie');
    await expect(page.locator('#msg-body')).toContainText('Leben');
    await expect(page.locator('#msg-body')).toContainText('Schlucht');
    await expect(page.locator('#msg-body')).toContainText('Level');
    await expect(page.locator('#msg-body')).not.toContainText('Stufe');
    await expect(page.locator('#msg-buttons button')).toHaveText(['Verstanden', 'Tutorial']);
    await expect(page.locator('#msg-buttons button').first()).toHaveClass(/main/);
    await page.getByRole('button', { name: 'Verstanden' }).click();
    await expect(page.locator('#msg')).toBeHidden();
    await expect(page.locator('#menu')).toBeVisible();
  });

  test('Eingebettet: verlorener Lauf sendet kein jnr:result', async ({ page }) => {
    await page.route('**/jumpnrun-harness.html', route => route.fulfill({
      contentType: 'text/html',
      body: '<!DOCTYPE html><html><body><script>window.__got=[];addEventListener("message",e=>window.__got.push(e.data));</script>' +
        '<iframe id="f" src="/jumpnrun/index.html?jnrSeed=1&jnrReihe=2"></iframe></body></html>'
    }));
    await page.goto('/jumpnrun-harness.html');
    const fw = () => page.evaluate(fn => document.getElementById('f').contentWindow.__jnr[fn](), 'state');
    await page.waitForFunction(() => document.getElementById('f').contentWindow.__jnr);
    await page.evaluate(() => document.getElementById('f').contentWindow.postMessage({ type: 'jnr:init', level: '1-2', jnr: {} }, location.origin));
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

test('Zahlen-Modus aus kommt ohne Reihenwahl aus', async ({ page }) => {
  await tutorialGesehen(page);
  await page.goto('/jumpnrun/index.html?jnrDebug=1');
  await page.locator('#opt-mathe').uncheck();
  await expect(page.locator('button[data-level="1-2"] small')).toHaveText('Laufen, Springen, Sammeln');
  await page.click('button[data-level="1-2"]');
  await expect(page.locator('#reihenwahl')).toBeHidden();
  expect(await state(page)).toMatchObject({ mode: 'play', level: '1-2', reihe: null });
  await expect(page.locator('#ziel')).toHaveText('Sammle alle Funken');
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

test('Pause: Weiter, Nochmal, ? So spielst du, Zum Menü; Nochmal startet sofort dieselbe Reihe, nicht die Empfehlung', async ({ page }) => {
  await harness(page);
  await page.goto('/jumpnrun-harness.html');
  const frame = page.frameLocator('#f');
  const fs = () => page.evaluate(() => document.getElementById('f').contentWindow.__jnr.state());
  await expect(frame.locator('#menu')).toBeVisible();
  await sendTo(page, INIT12);
  await frame.locator('#rw-grid .rw[data-reihe="4"]').click();
  await expect(frame.locator('#ziel .z-reihe')).toHaveText('4er-Reihe');
  await page.waitForTimeout(400);
  expect((await fs()).t).toBeGreaterThan(0);
  await frame.locator('#btn-pause').click();
  await expect(frame.locator('#msg-buttons button')).toHaveText(['Weiter', 'Nochmal', '? So spielst du', 'Zum Menü']);
  await frame.getByRole('button', { name: 'Nochmal' }).click();
  await expect(frame.locator('#msg')).toBeHidden();
  await expect(frame.locator('#reihenwahl')).toBeHidden(); // kein Zwischenschritt (B5)
  await expect(frame.locator('#ziel .z-reihe')).toHaveText('4er-Reihe');
  const s = await fs();
  expect(s).toMatchObject({ mode: 'play', reihe: 4, funken: 0 });
  expect(s.t).toBeLessThan(30); // neuer Lauf
});

test('Geschafft: Nochmal startet sofort dieselbe Reihe neu, Zum Menü geht ins Menü (kein nächstes Level in Welt 1)', async ({ page }) => {
  await harness(page);
  await page.goto('/jumpnrun-harness.html');
  const frame = page.frameLocator('#f');
  await expect(frame.locator('#menu')).toBeVisible();
  await sendTo(page, INIT12);
  await frame.locator('#rw-grid .rw[data-reihe="4"]').click();
  // Lumo direkt vor den Leuchtturm setzen
  const zumZiel = () => page.evaluate(() => {
    const w = document.getElementById('f').contentWindow;
    w.__jnr.teleport(w.__jnr.goal().tx, w.__jnr.goal().ty - 1);
  });
  await zumZiel();
  await expect(frame.locator('#msg-title')).toHaveText('Geschafft!', { timeout: 5000 });
  await expect(frame.locator('#msg-buttons button')).toHaveText(['Nochmal', 'Zum Menü']);
  await expect(frame.locator('#msg-buttons button').first()).toHaveClass(/main/);
  await frame.locator('#msg').getByRole('button', { name: 'Nochmal' }).click();
  await expect(frame.locator('#msg')).toBeHidden();
  await expect(frame.locator('#reihenwahl')).toBeHidden();
  await expect(frame.locator('#ziel .z-reihe')).toHaveText('4er-Reihe');
  expect(await page.evaluate(() => document.getElementById('f').contentWindow.__jnr.state())).toMatchObject({ mode: 'play', reihe: 4 });
  await zumZiel();
  await expect(frame.locator('#msg-title')).toHaveText('Geschafft!', { timeout: 5000 });
  await frame.locator('#msg').getByRole('button', { name: 'Zum Menü' }).click();
  await expect(frame.locator('#menu')).toBeVisible();
});

test('Stern-Zeit-Ende während der Reihenwahl blendet die Auswahl aus und zeigt den Dialog', async ({ page }) => {
  await harness(page);
  await page.goto('/jumpnrun-harness.html');
  const frame = page.frameLocator('#f');
  await expect(frame.locator('#menu')).toBeVisible();
  await sendTo(page, INIT12);
  await expect(frame.locator('#reihenwahl')).toBeVisible();
  await sendTo(page, { type: 'jnr:timeup' });
  await expect(frame.locator('#reihenwahl')).toBeHidden();
  await expect(frame.locator('#msg-title')).toHaveText('Deine Stern-Zeit ist vorbei');
  await expect(frame.locator('#msg')).not.toContainText('Spielzeit vorbei');
});

// Harness mit Mitschnitt aller Nachrichten Spiel -> Trainer (window.__got)
const gotHarness = (page) => page.route('**/jumpnrun-harness.html', route => route.fulfill({
  contentType: 'text/html',
  body: '<!DOCTYPE html><html><body><script>window.__got=[];addEventListener("message",e=>window.__got.push(e.data));</script>' +
    '<iframe id="f" style="width:844px;height:390px" src="/jumpnrun/index.html?jnrSeed=1"></iframe></body></html>'
}));
const beendenZaehler = page => page.evaluate(() => window.__got.filter(m => m && m.type === 'jnr:beenden').length);

test('Stern-Zeit-Ende im Level: Dialog mit genau einem Knopf „Zurück zum Trainer“, der jnr:beenden sendet (Enter und Esc ebenso)', async ({ page }) => {
  await gotHarness(page);
  await page.goto('/jumpnrun-harness.html');
  const frame = page.frameLocator('#f');
  const fs = () => page.evaluate(() => document.getElementById('f').contentWindow.__jnr.state());
  await expect(frame.locator('#menu')).toBeVisible();
  await sendTo(page, INIT12);
  await frame.locator('#rw-grid .rw[data-reihe="4"]').click();
  await expect.poll(async () => (await fs()).mode).toBe('play');
  await sendTo(page, { type: 'jnr:timeup' });
  await expect(frame.locator('#msg-title')).toHaveText('Deine Stern-Zeit ist vorbei');
  await expect(frame.locator('#hud')).toBeHidden();
  await expect(frame.locator('#msg-buttons button')).toHaveText(['Zurück zum Trainer']);
  await expect(frame.locator('#msg-buttons button')).toHaveClass(/main/);
  await expect(frame.locator('#msg-buttons button')).toBeFocused();
  expect((await fs()).mode).toBe('ended');
  expect(await beendenZaehler(page)).toBe(0);
  await frame.locator('#msg-buttons button').click();
  await expect.poll(() => beendenZaehler(page)).toBe(1);
  // Der Dialog bleibt stehen, bis der Trainer das Overlay schliesst; Tastatur geht genauso
  await expect(frame.locator('#msg')).toBeVisible();
  await page.evaluate(() => document.getElementById('f').contentWindow.focus());
  await page.keyboard.press('Enter');
  await expect.poll(() => beendenZaehler(page)).toBe(2);
  await page.keyboard.press('Escape');
  await expect.poll(() => beendenZaehler(page)).toBe(3);
  expect((await fs()).mode).toBe('ended');
});

test('Eingebettet: Menü hat „Zurück zum Trainer“, der Knopf sendet jnr:beenden', async ({ page }) => {
  await gotHarness(page);
  await page.goto('/jumpnrun-harness.html');
  const frame = page.frameLocator('#f');
  await expect(frame.locator('#menu')).toBeVisible();
  await expect(frame.locator('#btn-trainer')).toBeVisible();
  await expect(frame.locator('#btn-trainer')).toHaveText('Zurück zum Trainer');
  await frame.locator('#btn-trainer').click();
  await expect.poll(() => beendenZaehler(page)).toBe(1);
});

test('Standalone: kein „Zurück zum Trainer“ im Menü', async ({ page }) => {
  await page.goto('/jumpnrun/index.html');
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#btn-trainer')).toBeHidden();
  await expect(page.locator('#menu')).not.toContainText('Zurück zum Trainer', { useInnerText: true });
});

test('Reihenwahl: Knöpfe ?, Zum Menü, Los (Start rechts außen); Zum Menü geht ins Menü', async ({ page }) => {
  await page.goto(URL2);
  await expect(page.locator('#reihenwahl')).toBeVisible();
  await expect(page.locator('#reihenwahl .rw-buttons button')).toHaveText(['?', 'Zum Menü', 'Los mit der 2er-Reihe']);
  const boxes = await page.locator('#reihenwahl .rw-buttons button').evaluateAll(bs => bs.map(b => b.getBoundingClientRect().x));
  expect(boxes[0]).toBeLessThan(boxes[1]);
  expect(boxes[1]).toBeLessThan(boxes[2]);
  await expect(page.locator('#reihenwahl')).not.toContainText('Zurück');
  await page.getByRole('button', { name: 'Zum Menü' }).click();
  await expect(page.locator('#menu')).toBeVisible();
});

test('Menü: Tutorial-Knopf heißt immer „Tutorial“, Hilfe und Tutorial stehen nebeneinander', async ({ page }) => {
  await page.goto('/jumpnrun/index.html?jnrDebug=1');
  await expect(page.locator('#btn-tutorial')).toHaveText('Tutorial');
  await tutorialGesehen(page);
  await page.goto('/jumpnrun/index.html?jnrDebug=1');
  await expect(page.locator('#btn-tutorial')).toHaveText('Tutorial');
  const [h, t] = await Promise.all([page.locator('#btn-hilfe').boundingBox(), page.locator('#btn-tutorial').boundingBox()]);
  expect(Math.abs(h.y - t.y)).toBeLessThan(2); // eine Zeile
  expect(h.x + h.width).toBeLessThanOrEqual(t.x + 1);
});

test.describe('Menü quer 844×340 (iPhone im Trainer-iframe, B8)', () => {
  test.use({ viewport: { width: 844, height: 340 } });
  test('Tutorial-Knopf liegt ohne Scrollen im Bild, kein Tastatur-Hinweis auf Touch', async ({ page }) => {
    await page.goto('/jumpnrun/index.html?jnrDebug=1');
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page.locator('#menu')).not.toContainText('Tastatur', { useInnerText: true });
    const card = await page.locator('#menu .card').evaluate(c => ({ sh: c.scrollHeight, ch: c.clientHeight, st: c.scrollTop }));
    expect(card.st).toBe(0);
    expect(card.sh).toBeLessThanOrEqual(card.ch);
    const b = await page.locator('#btn-tutorial').boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(340);
    expect(b.height).toBeGreaterThanOrEqual(44);
  });
});

// ---------- Rechenwicht (Spec "Lumo Leben, Gegner und Reihenwahl", Abschnitt 3 und 5) ----------
test.describe('Lumo: Rechenwicht', () => {
  const URLW = '/jumpnrun/index.html?jnrLevel=1-2&jnrSeed=1&jnrReihe=7';

  test('Hilfe erklärt den Rechenwicht (draufspringen, Seite kostet Energie)', async ({ page }) => {
    await page.goto('/jumpnrun/index.html?jnrDebug=1');
    await page.click('#btn-hilfe');
    await expect(page.locator('#msg-body')).toContainText('Rechenwicht');
    await expect(page.locator('#msg-body')).toContainText('von oben');
    await expect(page.locator('#msg-body')).toContainText('von der Seite');
  });

  test('Start-Hinweis in Stufe 1-2 nennt den Rechenwicht und das Draufspringen', async ({ page }) => {
    await page.goto(URLW);
    await expect(page.locator('#tipp')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#tipp')).toContainText('Rechenwicht');
    await expect(page.locator('#tipp')).toContainText('von oben');
  });

  test('Zahlen aus: Stufe 1-2 ohne Rechenwichte', async ({ page }) => {
    await page.goto('/jumpnrun/index.html?jnrSeed=1');
    await page.locator('#opt-mathe').uncheck();
    await page.evaluate(() => window.__jnr.start('1-2'));
    const s = await state(page);
    expect(s).toMatchObject({ mode: 'play', level: '1-2', reihe: null });
    expect(await page.evaluate(() => window.__jnr.enemies())).toEqual([]);
  });

  test('Stufe 1-2: Wichte tragen eine falsche Rechnung aus der gewählten Reihe', async ({ page }) => {
    await page.goto(URLW);
    const list = await page.evaluate(() => window.__jnr.enemies());
    expect(list.length).toBeGreaterThan(0);
    list.forEach(e => {
      expect(e.state).toBe('da');
      expect(e.falsch).toMatch(/^7×\d+=\d+$/);
      expect(e.richtig).toMatch(/^7×\d+=\d+$/);
      expect(e.falsch).not.toBe(e.richtig);
    });
    expect((await state(page)).level).toBe('1-2');
  });

  test('Draufspringen: Tafel deckt auf, Funke, keine Energie verloren', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URLW);
    await page.waitForTimeout(200);
    const i = await page.evaluate(() => { window.__jnr.debugAmWicht(0, 1, -16); return 0; });
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
    const i = await page.evaluate(() => { // von der Seite, auf der der Wicht noch Laufstrecke hat (dort liegt nie ein Kristall)
      const e = window.__jnr.enemies()[0];
      window.__jnr.debugAmWicht(0, e.x - e.minX > 20 ? -6 : 8, 4); return 0; });
    await expect(page.locator('#energie i.leer')).toHaveCount(1);
    const s = await state(page);
    expect(s.energie).toBe(2);
    expect(s.fehltreffer).toBe(1);
    expect(await page.evaluate(k => window.__jnr.enemies()[k].state, i)).toBe('da');
  });
});

// ---------- Mitmach-Tutorial (core/tutorial.js, Spec "Lumo Leben, Gegner und Reihenwahl", Abschnitt 5) ----------
test.describe('Lumo: Mitmach-Tutorial am Laptop (Tastatur)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  const tut = page => page.evaluate(() => window.__jnr.state().tutorial);
  const wartenAuf = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout, polling: 'raf' });
  async function springen(page, haltenMs = 350) {
    await page.keyboard.down('Space'); await page.waitForTimeout(haltenMs); await page.keyboard.up('Space');
  }
  // Wiederholt fn, bis der Tutorial-Schritt weiter ist (Fehlversuche kosten im Tutorial nichts)
  async function bisSchritt(page, ziel, versuch, max = 6) {
    for (let i = 0; i < max; i++) {
      if ((await tut(page)).schritt === ziel) return;
      await versuch();
      try { await wartenAuf(page, z => window.__jnr.state().tutorial.schritt === z, ziel, 2500); return; } catch (e) { /* nochmal */ }
    }
    expect((await tut(page)).schritt).toBe(ziel);
  }

  test('erster Menü-Klick startet das Tutorial; per Tastatur bis zum Leuchtturm, dann weiter ins Level, ohne XP und ohne Lebensverlust', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/jumpnrun/index.html?jnrDebug=1');
    await page.focus('button[data-level="1-2"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('#tut-box')).toBeVisible();
    await expect(page.locator('#tut-schritt')).toHaveText('Schritt 1 von 5');
    await expect(page.locator('#tut-text')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#tut-text')).toContainText('Pfeiltaste'); // Laptop: Tasten statt Touch-Knöpfe
    expect(await tut(page)).toMatchObject({ schritt: 'laufen', fertig: false });
    await page.waitForTimeout(300);

    // 1) laufen
    await page.keyboard.down('ArrowRight');
    await wartenAuf(page, () => window.__jnr.state().tutorial.schritt === 'springen');
    await expect(page.locator('#tut-text')).toContainText('Leertaste');

    // 2) über die Lücke springen (Spalten 9-10)
    await bisSchritt(page, 'zahlen', async () => {
      await page.keyboard.down('ArrowRight');
      await wartenAuf(page, () => { const s = window.__jnr.state(); return s.onGround && s.x >= 250 && s.x < 268; });
      await springen(page);
    });
    await expect(page.locator('#tut-text')).toContainText('2er-Reihe');
    await expect(page.locator('#tut-text')).toContainText('6'); // richtige Zahl der 2er-Reihe

    // 3) die 6 einsammeln, über die 7 springen
    await bisSchritt(page, 'wicht', async () => {
      await page.keyboard.down('ArrowRight');
      await wartenAuf(page, () => { const s = window.__jnr.state(); return s.onGround && s.x >= 422 && s.x < 440; });
      await springen(page);
    });
    expect((await state(page)).funken).toBeGreaterThanOrEqual(1);
    await expect(page.locator('#tut-text')).toContainText('von oben');

    // 4) von oben auf den Rechenwicht springen
    await bisSchritt(page, 'ziel', async () => {
      await page.keyboard.down('ArrowRight');
      await wartenAuf(page, () => {
        const s = window.__jnr.state(), e = window.__jnr.enemies()[0];
        if (!e || e.state !== 'da' || !s.onGround) return false;
        const gap = e.x - (s.x + 10);
        return e.dir < 0 ? gap <= 52 && gap >= 40 : gap <= 28 && gap >= 8;
      });
      await springen(page, 500);
    }, 10);
    await expect(page.locator('#tut-text')).toContainText('richtige Rechnung');

    // 5) zum Leuchtturm
    await page.keyboard.down('ArrowRight');
    await expect(page.locator('#msg-title')).toHaveText('Tutorial geschafft!', { timeout: 10000 });
    await page.keyboard.up('ArrowRight');
    await expect(page.locator('#tut-box')).toBeHidden(); // Sprechblase weg, sobald der Dialog kommt
    const s = await state(page);
    expect(s.leben).toBe(3);
    expect(s.tutorialGesehen).toBe(true);
    const gespeichert = await page.evaluate(() => JSON.parse(localStorage.getItem('henry_jnr')));
    expect(gespeichert.tutorialGesehen).toBe(true);
    expect(gespeichert.levels).toEqual({}); // kein Levelfortschritt, keine XP aus dem Tutorial
    expect(gespeichert.xpAwarded).toEqual({});

    // Enter auf dem Hauptknopf: weiter zur gewählten Zahlenwiese, zuerst die Reihenwahl
    await expect(page.locator('#msg-buttons button')).toHaveText(['Weiter', 'Nochmal']);
    await expect(page.locator('#msg-body')).toContainText('im Menü unter „Tutorial“');
    await expect(page.getByRole('button', { name: 'Weiter' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#tut-box')).toBeHidden();
    expect(await state(page)).toMatchObject({ mode: 'reihenwahl', tutorial: null });
    expect(await page.evaluate(() => window.__jnr.reihenwahl().level)).toBe('1-2');
    await page.keyboard.press('Enter');
    expect(await state(page)).toMatchObject({ mode: 'play', level: '1-2', tutorial: null });

    // Beim nächsten Mal kommt kein Tutorial mehr
    await page.reload();
    await page.click('button[data-level="1-2"]');
    await expect(page.locator('#tut-box')).toBeHidden();
    expect(await state(page)).toMatchObject({ mode: 'reihenwahl' });
    expect(errors).toEqual([]);
  });

  test('Einfach-Steuerung (Lumo läuft von selbst): nur mit der Leertaste bis zum Leuchtturm, kein Festhängen', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('henry_jnr', JSON.stringify({ options: { steuerung: 'einfach' } })));
    await page.goto('/jumpnrun/index.html?jnrTutorial=1');
    await expect(page.locator('#tut-text')).toContainText('von selbst');
    await wartenAuf(page, () => window.__jnr.state().tutorial.schritt === 'springen');
    await bisSchritt(page, 'zahlen', async () => {
      await wartenAuf(page, () => { const s = window.__jnr.state(); return s.onGround && s.x >= 250 && s.x < 268; });
      await springen(page);
    }, 8);
    await bisSchritt(page, 'wicht', async () => {
      await wartenAuf(page, () => { const s = window.__jnr.state(); return s.onGround && s.x >= 422 && s.x < 440; });
      await springen(page);
    }, 8);
    await bisSchritt(page, 'ziel', async () => {
      await wartenAuf(page, () => {
        const s = window.__jnr.state(), e = window.__jnr.enemies()[0];
        if (!e || e.state !== 'da' || !s.onGround) return false;
        const gap = e.x - (s.x + 10);
        return e.dir < 0 ? gap <= 52 && gap >= 40 : gap <= 28 && gap >= 8;
      }, undefined, 15000);
      await springen(page, 500);
    }, 10);
    await expect(page.locator('#msg-title')).toHaveText('Tutorial geschafft!', { timeout: 15000 });
    expect((await state(page)).leben).toBe(3);
  });

  test('Überspringen per Tastatur (Tab + Enter) startet direkt das gewählte Level und merkt es sich', async ({ page }) => {
    await page.goto('/jumpnrun/index.html?jnrDebug=1&jnrReihe=2');
    await page.click('button[data-level="1-2"]');
    await expect(page.locator('#tut-box')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('#tut-skip')).toBeFocused();
    await expect(page.locator('#tut-skip')).toHaveText('Überspringen');
    await page.keyboard.press('Enter');
    await expect(page.locator('#tut-box')).toBeHidden();
    expect(await state(page)).toMatchObject({ mode: 'play', level: '1-2', tutorial: null, tutorialGesehen: true });
    expect((await page.evaluate(() => JSON.parse(localStorage.getItem('henry_jnr')))).tutorialGesehen).toBe(true);
  });

  test('Tutorial-Pause (Esc): Weiter, Nochmal, Überspringen, keine Hilfe; Überspringen ohne Level geht ins Menü', async ({ page }) => {
    await page.goto('/jumpnrun/index.html?jnrTutorial=1');
    await expect(page.locator('#tut-box')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#msg-title')).toHaveText('Pause');
    await expect(page.locator('#tut-box')).toBeHidden(); // keine Sprechblase über dem Pausenmenü
    await expect(page.locator('#msg-buttons button')).toHaveText(['Weiter', 'Nochmal', 'Überspringen']);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.locator('#tut-box')).toBeVisible(); // nach Weiter wieder da
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Überspringen' }).click();
    await expect(page.locator('#menu')).toBeVisible(); // ohne gewähltes Level zurück ins Menü
    await expect(page.locator('#btn-tutorial')).toHaveText('Tutorial');
  });

  test('Tutorial starten: Menü-Knopf „Tutorial“, Hilfe-Knopf „Tutorial“, in der Tutorial-Pause „Nochmal“', async ({ page }) => {
    await tutorialGesehen(page);
    await page.goto('/jumpnrun/index.html?jnrDebug=1');
    await page.click('button[data-level="1-2"]');
    await expect(page.locator('#tut-box')).toBeHidden(); // schon gesehen: kein Autostart
    await page.goto('/jumpnrun/index.html?jnrDebug=1');
    await page.click('#btn-tutorial');
    await expect(page.locator('#tut-box')).toBeVisible();
    expect((await tut(page)).schritt).toBe('laufen');
    await page.keyboard.down('ArrowRight');
    await wartenAuf(page, () => window.__jnr.state().tutorial.schritt === 'springen');
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(page.locator('#msg-title')).toHaveText('Pause');
    await expect(page.getByRole('button', { name: '? So spielst du' })).toHaveCount(0); // das Tutorial erklärt selbst
    await page.getByRole('button', { name: 'Nochmal' }).click();
    await expect(page.locator('#msg')).toBeHidden();
    expect(await tut(page)).toMatchObject({ schritt: 'laufen', index: 0 });
    await page.goto('/jumpnrun/index.html?jnrDebug=1');
    await page.click('#btn-hilfe');
    await page.locator('#msg').getByRole('button', { name: 'Tutorial' }).click();
    await expect(page.locator('#msg')).toBeHidden();
    await expect(page.locator('#tut-box')).toBeVisible();
  });

  test('Hilfe aus der Level-Pause hat nur „Verstanden“ (kein Tutorial-Knopf, der das Level verwirft) und führt zur Pause zurück', async ({ page }) => {
    await page.goto(URL1);
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await expect(page.locator('#msg-title')).toHaveText('Pause');
    await page.getByRole('button', { name: '? So spielst du' }).click();
    await expect(page.locator('#msg-title')).toHaveText('So spielst du');
    await expect(page.locator('#msg-buttons button')).toHaveText(['Verstanden']);
    await expect(page.locator('#msg-body')).not.toContainText('Stufe');
    await page.keyboard.press('Escape'); // Esc = Verstanden = zurück in die Pause
    await expect(page.locator('#msg-title')).toHaveText('Pause');
    expect(await state(page)).toMatchObject({ mode: 'pause', level: '1-2', tutorial: null });
  });

  // Hilfsweg zum Leuchtturm: teleport loest das Ziel-Ereignis aus (wie "Nochmal nach dem Ziel")
  const zumLeuchtturm = page => page.evaluate(() => { const g = window.__jnr.goal(); window.__jnr.teleport(g.tx, g.ty - 1); });

  test('Tutorial geschafft (aus dem Menü): „Zum Menü“ (Hauptknopf) und „Nochmal“, Esc = Zum Menü', async ({ page }) => {
    await tutorialGesehen(page);
    await page.goto('/jumpnrun/index.html?jnrDebug=1');
    await page.click('#btn-tutorial');
    await expect(page.locator('#tut-box')).toBeVisible();
    await zumLeuchtturm(page);
    // #msg-title behaelt den alten Text, solange der Dialog versteckt ist: erst auf den sichtbaren Dialog warten
    await expect(page.locator('#msg')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#msg-title')).toHaveText('Tutorial geschafft!');
    await expect(page.locator('#msg-buttons button')).toHaveText(['Zum Menü', 'Nochmal']);
    await expect(page.locator('#msg-buttons button').first()).toHaveClass(/main/);
    await expect(page.locator('#msg-body')).toContainText('im Menü unter „Tutorial“');
    await expect(page.locator('#msg-body')).not.toContainText('So spielst du');
    await page.getByRole('button', { name: 'Nochmal' }).click();
    await expect(page.locator('#msg')).toBeHidden();
    await expect(page.locator('#tut-box')).toBeVisible();
    expect(await tut(page)).toMatchObject({ schritt: 'laufen', index: 0, fertig: false });
    await zumLeuchtturm(page);
    // #msg-title behaelt den alten Text, solange der Dialog versteckt ist: erst auf den sichtbaren Dialog warten
    await expect(page.locator('#msg')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#msg-title')).toHaveText('Tutorial geschafft!');
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu')).toBeVisible();
    expect(await state(page)).toMatchObject({ mode: 'menu', tutorial: null });
  });

  test('Tutorial geschafft (vom Level gestartet): „Weiter“ führt in die Reihenwahl des Levels, „Nochmal“ merkt sich das Level', async ({ page }) => {
    await page.goto('/jumpnrun/index.html?jnrDebug=1');
    await page.click('button[data-level="1-2"]'); // erstes Mal: Tutorial zuerst
    await expect(page.locator('#tut-box')).toBeVisible();
    await zumLeuchtturm(page);
    // #msg-title behaelt den alten Text, solange der Dialog versteckt ist: erst auf den sichtbaren Dialog warten
    await expect(page.locator('#msg')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#msg-title')).toHaveText('Tutorial geschafft!');
    await expect(page.locator('#msg-buttons button')).toHaveText(['Weiter', 'Nochmal']);
    await page.getByRole('button', { name: 'Nochmal' }).click();
    await expect(page.locator('#tut-box')).toBeVisible();
    expect(await tut(page)).toMatchObject({ schritt: 'laufen', index: 0 });
    await zumLeuchtturm(page);
    // #msg-title behaelt den alten Text, solange der Dialog versteckt ist: erst auf den sichtbaren Dialog warten
    await expect(page.locator('#msg')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#msg-title')).toHaveText('Tutorial geschafft!');
    await expect(page.locator('#msg-buttons button')).toHaveText(['Weiter', 'Nochmal']); // Level bleibt gemerkt
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.locator('#reihenwahl')).toBeVisible();
    expect(await state(page)).toMatchObject({ mode: 'reihenwahl', tutorial: null });
    expect(await page.evaluate(() => window.__jnr.reihenwahl().level)).toBe('1-2');
  });

  test('Tastatur-Hinweis im Menü nur mit feinem Zeiger (Laptop)', async ({ page }) => {
    await page.goto('/jumpnrun/index.html');
    await expect(page.locator('#menu')).toContainText('Tastatur: Pfeile oder A/D');
  });

  test('Schlucht im Tutorial kostet kein Leben', async ({ page }) => {
    await page.goto('/jumpnrun/index.html?jnrTutorial=1');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__jnr.debugFall());
    await expect(page.locator('#tut-text')).toContainText('Schlucht');
    const s = await state(page);
    expect(s.leben).toBe(3);
    await expect(page.locator('#leben')).toHaveAttribute('aria-label', 'Leben: 3 von 3');
  });
});

test.describe('Lumo: Mitmach-Tutorial auf dem Handy', () => {
  test('Touch-Gerät: Texte nennen die Knöpfe, der passende Knopf wird hervorgehoben', async ({ page }) => {
    await page.goto('/jumpnrun/index.html?jnrTutorial=1');
    await expect(page.locator('#tut-text')).toContainText('▶');
    await expect(page.locator('#btn-right')).toHaveClass(/zeig/);
  });

  test('Eingebettet: Überspringen meldet jnr:tutorial an den Trainer, nie jnr:result', async ({ page }) => {
    await page.route('**/jumpnrun-harness.html', route => route.fulfill({
      contentType: 'text/html',
      body: '<!DOCTYPE html><html><body><script>window.__got=[];addEventListener("message",e=>window.__got.push(e.data));</script>' +
        '<iframe id="f" style="width:844px;height:390px" src="/jumpnrun/index.html?jnrSeed=1&jnrReihe=2"></iframe></body></html>'
    }));
    await page.goto('/jumpnrun-harness.html');
    const frame = page.frameLocator('#f');
    await expect(frame.locator('#menu')).toBeVisible();
    await sendTo(page, { type: 'jnr:init', jnr: {} });
    await frame.locator('button[data-level="1-2"]').click();
    await expect(frame.locator('#tut-box')).toBeVisible();
    await frame.locator('#tut-skip').click();
    await expect(frame.locator('#tut-box')).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.__got.filter(m => m && m.type === 'jnr:tutorial')))
      .toEqual([{ type: 'jnr:tutorial', gesehen: true }]);
    const got = await page.evaluate(() => window.__got);
    expect(got.filter(m => m && m.type === 'jnr:result')).toEqual([]);
    // eingebettet kein localStorage-Schreiben, aber der Sitzungs-Fallback hält
    expect(await page.evaluate(() => document.getElementById('f').contentWindow.localStorage.getItem('henry_jnr'))).toBeNull();
    await sendTo(page, { type: 'jnr:init', jnr: {} }); // alter Trainer ohne Flag
    await page.evaluate(() => { const w = document.getElementById('f').contentWindow; w.document.getElementById('btn-pause').click(); });
    await frame.getByRole('button', { name: 'Zum Menü' }).click();
    await frame.locator('button[data-level="1-2"]').click();
    await expect(frame.locator('#tut-box')).toBeHidden();
  });
});

test.describe('jnr:aktiv an den Trainer (Stern-Zeit nur im aktiven Spiel)', () => {
  const aktivHarness = (page) => page.route('**/jumpnrun-harness.html', route => route.fulfill({
    contentType: 'text/html',
    body: '<!DOCTYPE html><html><body><script>window.__aktiv = []; window.addEventListener("message", function (e) {' +
      ' if (e.data && e.data.type === "jnr:aktiv") window.__aktiv.push(e.data.aktiv); });</script>' +
      '<iframe id="f" style="width:844px;height:390px" src="/jumpnrun/index.html?jnrSeed=1&jnrReihe=2"></iframe></body></html>'
  }));
  const aktiv = page => page.evaluate(() => window.__aktiv.slice());
  const letztes = async page => { const a = await aktiv(page); return a[a.length - 1]; };
  const fs = page => page.evaluate(() => document.getElementById('f').contentWindow.__jnr.state());

  test('Menü meldet nicht aktiv, Level und Tutorial aktiv, Pause, Game Over und timeup nicht aktiv', async ({ page }) => {
    await aktivHarness(page);
    await page.goto('/jumpnrun-harness.html');
    await expect.poll(() => aktiv(page)).toEqual([false]); // Startstand: Menü
    await sendTo(page, { type: 'jnr:init', jnr: { tutorialGesehen: true } });
    await expect.poll(() => aktiv(page)).toEqual([false, false]); // Antwort auf jnr:init
    await sendTo(page, { type: 'jnr:init', level: '1-2', jnr: { tutorialGesehen: true } });
    await expect.poll(() => letztes(page)).toBe(true);
    await sendTo(page, { type: 'jnr:pause' });
    await expect.poll(() => letztes(page)).toBe(false);
    expect((await fs(page)).mode).toBe('pause');

    await page.evaluate(() => document.getElementById('f').contentWindow.__jnr.startTutorial());
    await expect.poll(() => letztes(page)).toBe(true); // Tutorial zählt als aktives Spiel

    await page.evaluate(() => document.getElementById('f').contentWindow.__jnr.start('1-2'));
    await page.evaluate(() => { const j = document.getElementById('f').contentWindow.__jnr; j.debugSet({ leben: 1 }); j.debugFall(); });
    await expect.poll(async () => (await fs(page)).mode).toBe('lost');
    expect(await letztes(page)).toBe(false);

    await page.evaluate(() => document.getElementById('f').contentWindow.__jnr.start('1-2'));
    await expect.poll(() => letztes(page)).toBe(true);
    await sendTo(page, { type: 'jnr:timeup' });
    await expect.poll(() => letztes(page)).toBe(false);
    // Nur Wechsel werden gemeldet (Tutorial -> Level bleibt aktiv: keine Meldung), dazu je eine
    // Antwort auf jedes jnr:init (beim Direktstart also zweimal true).
    expect(await aktiv(page)).toEqual([false, false, true, true, false, true, false, true, false]);
  });
});

test.describe('Debug-Hilfen nur mit Debug-Parameter', () => {
  test('ohne Parameter gibt es kein window.__jnr, mit ?jnrDebug=1 schon', async ({ page }) => {
    await page.goto('/jumpnrun/index.html');
    await expect(page.locator('#menu')).toBeVisible();
    expect(await page.evaluate(() => typeof window.__jnr)).toBe('undefined');
    await page.goto('/jumpnrun/index.html?jnrDebug=1');
    await expect(page.locator('#menu')).toBeVisible();
    expect(await page.evaluate(() => typeof window.__jnr.state)).toBe('function');
  });
});

test.describe('Querformat-Pflicht auf Touch-Geräten', () => {
  const vollHarness = (page) => page.route('**/jumpnrun-harness.html', route => route.fulfill({
    contentType: 'text/html',
    body: '<!DOCTYPE html><html><head><style>html,body{margin:0;height:100%;overflow:hidden}</style></head><body>' +
      '<script>window.__aktiv = []; window.addEventListener("message", function (e) {' +
      ' if (e.data && e.data.type === "jnr:aktiv") window.__aktiv.push(e.data.aktiv); });</script>' +
      '<iframe id="f" style="border:0;width:100vw;height:100vh;display:block" src="/jumpnrun/index.html?jnrSeed=1&jnrReihe=2"></iframe></body></html>'
  }));
  const letztes = async page => { const a = await page.evaluate(() => window.__aktiv.slice()); return a[a.length - 1]; };
  const fs = page => page.evaluate(() => document.getElementById('f').contentWindow.__jnr.state());

  test('Level: Hochformat pausiert und meldet nicht aktiv, Querformat lässt die Pause stehen', async ({ page }) => {
    await vollHarness(page);
    await page.goto('/jumpnrun-harness.html');
    const frame = page.frameLocator('#f');
    await expect.poll(() => letztes(page)).toBe(false);
    await sendTo(page, { type: 'jnr:init', level: '1-2', jnr: { tutorialGesehen: true } });
    await expect.poll(() => letztes(page)).toBe(true);
    expect((await fs(page)).mode).toBe('play');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(frame.locator('#portrait-hint')).toBeVisible();
    await expect.poll(async () => (await fs(page)).mode).toBe('pause');
    await expect.poll(() => letztes(page)).toBe(false);
    // Tastatur (z.B. iPad mit Tastatur) kann hinter der Anzeige nicht weiterspielen.
    // Fokus ins Lumo-iframe, sonst landen die Tasten im Harness.
    await page.evaluate(() => document.getElementById('f').contentWindow.focus());
    expect(await page.evaluate(() => document.getElementById('f').contentDocument.hasFocus())).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect((await fs(page)).mode).toBe('pause');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    expect((await fs(page)).mode).toBe('pause');
    // Auch der (verdeckte) Weiter-Knopf setzt das Spiel nicht fort
    await page.evaluate(() => {
      const d = document.getElementById('f').contentDocument;
      [...d.querySelectorAll('#msg-buttons button')].find(b => b.textContent === 'Weiter').click();
    });
    expect((await fs(page)).mode).toBe('pause');
    expect(await letztes(page)).toBe(false);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(frame.locator('#portrait-hint')).toBeHidden();
    await expect(frame.locator('#msg')).toBeVisible();
    await expect(frame.getByRole('button', { name: 'Weiter' })).toBeVisible();
    expect((await fs(page)).mode).toBe('pause');
    expect(await letztes(page)).toBe(false);
    await frame.getByRole('button', { name: 'Weiter' }).click();
    await expect.poll(() => letztes(page)).toBe(true);
  });

  test('Direktstart im Hochformat geht sofort in die Pause, ohne je aktiv zu melden', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await vollHarness(page);
    await page.goto('/jumpnrun-harness.html');
    const frame = page.frameLocator('#f');
    await expect.poll(() => page.evaluate(() => window.__aktiv.length)).toBe(1);
    await sendTo(page, { type: 'jnr:init', level: '1-2', jnr: { tutorialGesehen: true } });
    await expect.poll(async () => (await fs(page)).mode).toBe('pause');
    await expect(frame.locator('#portrait-hint')).toBeVisible();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__aktiv.slice())).toEqual([false, false]); // Start + Antwort auf jnr:init
    expect(await page.evaluate(() => document.getElementById('f').contentWindow.__jnr.state().pauseTon)).toBe(0);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(frame.getByRole('button', { name: 'Weiter' })).toBeVisible();
    await frame.getByRole('button', { name: 'Weiter' }).click();
    await expect.poll(() => letztes(page)).toBe(true);
  });

  test('Tutorial-Direktstart im Hochformat: sofort Pause, nie aktiv', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await vollHarness(page);
    await page.goto('/jumpnrun-harness.html');
    await expect.poll(() => page.evaluate(() => window.__aktiv.length)).toBe(1);
    await sendTo(page, { type: 'jnr:init', jnr: { tutorialGesehen: true } });
    await page.evaluate(() => document.getElementById('f').contentWindow.__jnr.startTutorial());
    await expect.poll(async () => (await fs(page)).mode).toBe('pause');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__aktiv.includes(true))).toBe(false);
    expect(await page.evaluate(() => document.getElementById('f').contentWindow.__jnr.state().pauseTon)).toBe(0);
  });

  test('Tutorial: Hochformat pausiert, nach dem Drehen bleibt das Pausenmenü', async ({ page }) => {
    await vollHarness(page);
    await page.goto('/jumpnrun-harness.html');
    const frame = page.frameLocator('#f');
    await sendTo(page, { type: 'jnr:init', jnr: {} });
    await frame.locator('button[data-level="1-2"]').click();
    await expect(frame.locator('#tut-box')).toBeVisible();
    await expect.poll(() => letztes(page)).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(frame.locator('#portrait-hint')).toBeVisible();
    await expect.poll(async () => (await fs(page)).mode).toBe('pause');
    await expect.poll(() => letztes(page)).toBe(false);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(frame.locator('#portrait-hint')).toBeHidden();
    await expect(frame.getByRole('button', { name: 'Weiter' })).toBeVisible();
    expect((await fs(page)).mode).toBe('pause');
  });
});

test.describe('Querformat-Pflicht: Laptop/Desktop bleibt unberührt', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test('schmales Hochformat-Fenster mit feinem Zeiger: kein Dreh-Hinweis, Level läuft', async ({ page }) => {
    await page.goto(URL1);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false);
    await expect(page.locator('#portrait-hint')).toBeHidden();
    const a = await state(page);
    expect(a.mode).toBe('play');
    await page.waitForTimeout(300);
    expect((await state(page)).t).toBeGreaterThan(a.t);
  });

  test('Menü im Hochformat-Fenster: kein Dreh-Hinweis', async ({ page }) => {
    await page.goto('/jumpnrun/index.html');
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page.locator('#portrait-hint')).toBeHidden();
  });
});
