const { test, expect, devices } = require('@playwright/test');

// Loest das aktuelle Raetsel ueber die Oberflaeche (Debug-Seed liefert die Loesung ueber window.__knobel).
async function loeseAktuelles(page) {
  const plan = await page.evaluate(() => {
    const { puzzle, modus } = window.__knobel.cur;
    const L = window.__knobel.L;
    const out = [];
    const n = puzzle.n;
    for (let r = 0; r < n; r++) {
      const breite = modus === 'mauer' ? n - r : n;
      for (let c = 0; c < breite; c++) {
        if (!L.istFest(modus, puzzle, r, c)) out.push({ r, c, wert: puzzle.loesung[r][c] });
      }
    }
    return out;
  });
  for (const z of plan) {
    await page.locator(`#board [data-r="${z.r}"][data-c="${z.c}"]`).click();
    for (const ch of String(z.wert)) await page.locator(`#pad .key[data-k="${ch}"]`).click();
  }
}

test.describe('Knobelwerkstatt', () => {
  test('Menue laedt und Zahlenmauer startet', async ({ page }) => {
    const fehler = [];
    page.on('pageerror', e => fehler.push(e.message));
    await page.goto('/knobel/index.html');
    await expect(page.locator('h1')).toHaveText('Knobelwerkstatt');
    await expect(page.locator('#xpinfo')).toContainText('600');
    await page.locator('#start-mauer').click();
    await expect(page.locator('#board.mauer')).toBeVisible();
    expect(await page.locator('#board .stone').count()).toBeGreaterThan(5);
    await expect(page.locator('#pad .key')).toHaveCount(11);
    expect(fehler).toEqual([]);
  });

  test('Zahlenmauer mit Debug-Seed loesbar, XP und Speicher stimmen', async ({ page }) => {
    await page.goto('/knobel/index.html?debug=1&modus=mauer&stufe=1&seed=1');
    await expect(page.locator('#board.mauer')).toBeVisible();
    await loeseAktuelles(page);
    await expect(page.locator('#solved')).toBeVisible();
    await expect(page.locator('#s-xp')).toHaveText('+80 XP');
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('henry_knobel')));
    expect(s.geloest.mauer).toBe(1);
    expect(s.tagesXp.xp).toBe(80);
    expect(s.laufend).toBeNull();
    // der Trainer-Speicher bleibt unberuehrt
    expect(await page.evaluate(() => localStorage.getItem('henry_einmaleins'))).toBeNull();
  });

  test('Rechenkaefige mit Debug-Seed loesbar, Tipp senkt die XP', async ({ page }) => {
    await page.goto('/knobel/index.html?debug=1&modus=kaefige&stufe=2&seed=3');
    await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
    await page.locator('#t-hint').click();
    await expect(page.locator('#t-hint')).toContainText('(1)');
    await loeseAktuelles(page);
    await expect(page.locator('#solved')).toBeVisible();
    await expect(page.locator('#s-xp')).toHaveText('+96 XP');
  });

  test('Fortschritt ueberlebt Neuladen', async ({ page }) => {
    await page.goto('/knobel/index.html?debug=1&modus=kaefige&stufe=1&seed=9');
    const frei = await page.evaluate(() => {
      const { puzzle, modus } = window.__knobel.cur, L = window.__knobel.L;
      for (let r = 0; r < puzzle.n; r++) for (let c = 0; c < puzzle.n; c++)
        if (!L.istFest(modus, puzzle, r, c)) return { r, c, wert: puzzle.loesung[r][c] };
    });
    await page.locator(`#board [data-r="${frei.r}"][data-c="${frei.c}"]`).click();
    await page.locator(`#pad .key[data-k="${frei.wert}"]`).click();
    await page.goto('/knobel/index.html');
    await expect(page.locator('#resume')).toBeVisible();
    await page.locator('#resume').click();
    await expect(page.locator(`#board [data-r="${frei.r}"][data-c="${frei.c}"]`)).toContainText(String(frei.wert));
  });

  test('eingebettet: knobel:result geht per postMessage an das Elternfenster', async ({ page }) => {
    // Eltern-Seite mit iframe gleicher Herkunft (hier die Knobelwerkstatt selbst als Host)
    await page.goto('/knobel/index.html');
    await page.evaluate(() => {
      window.__msgs = [];
      window.addEventListener('message', e => { if (e.data && e.data.type === 'knobel:result') window.__msgs.push(e.data); });
      const f = document.createElement('iframe');
      f.id = 'k'; f.style.cssText = 'width:390px;height:700px;position:fixed;inset:0;z-index:99';
      f.src = '/knobel/index.html?debug=1&modus=mauer&stufe=1&seed=1';
      document.body.appendChild(f);
    });
    const frame = page.frameLocator('#k');
    await expect(frame.locator('#board.mauer')).toBeVisible();
    const plan = await page.frame({ url: /debug=1/ }).evaluate(() => {
      const { puzzle, modus } = window.__knobel.cur, L = window.__knobel.L, out = [];
      for (let r = 0; r < puzzle.n; r++) for (let c = 0; c < puzzle.n - r; c++)
        if (!L.istFest(modus, puzzle, r, c)) out.push({ r, c, wert: puzzle.loesung[r][c] });
      return out;
    });
    for (const z of plan) {
      await frame.locator(`#board [data-r="${z.r}"][data-c="${z.c}"]`).click();
      for (const ch of String(z.wert)) await frame.locator(`#pad .key[data-k="${ch}"]`).click();
    }
    await expect(frame.locator('#solved')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__msgs.length)).toBe(1);
    const msgs = await page.evaluate(() => window.__msgs);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ type: 'knobel:result', mode: 'mauer', stufe: 1, tipps: 0, xp: 80, seed: 1 });
  });

  test('Weiter nach dem Loesen bleibt auf der gespielten Stufe, nicht der Empfehlung', async ({ page }) => {
    // Debug-Start simuliert eine manuell gewaehlte Stufe (4), waehrend die
    // Empfehlung im frischen Speicher bei Stufe 1 steht.
    await page.goto('/knobel/index.html?debug=1&modus=mauer&stufe=4&seed=1');
    await expect(page.locator('#board.mauer')).toBeVisible();
    await loeseAktuelles(page);
    await expect(page.locator('#solved')).toBeVisible();
    await page.locator('#s-next').click();
    await expect(page.locator('#title')).toContainText('Stufe 4');
  });

  test.describe('Querformat (echtes Geraete-Profil, dynamische Toolbar-Hoehe)', () => {
    const { defaultBrowserType, ...geraet } = devices['iPhone 13 landscape'];
    test.use(geraet);

    test('Zahlenmauer ueberlappt im Querformat nicht die Werkzeugleiste (Stufe 5, groesste Mauer)', async ({ page }) => {
      await page.goto('/knobel/index.html?debug=1&modus=mauer&stufe=5&seed=1');
      await expect(page.locator('#board.mauer')).toBeVisible();
      // Reale Pruefung: liegt in der Bildschirmmitte von "Pruefen" wirklich
      // der Knopf, oder faengt ein darueberliegender Stein den Klick ab?
      const getroffen = await page.locator('#t-check').evaluate(btn => {
        const r = btn.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return btn.contains(el);
      });
      expect(getroffen).toBe(true);
    });
  });
});
