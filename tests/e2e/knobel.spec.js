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
    // Erster Start dieses Modus: Mitmach-Tutorial geht dem Raetsel voraus.
    await expect(page.locator('#tutorial')).toBeVisible();
    await page.locator('#tut-ueberspringen').click();
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

  test('Tipp zeigt eine Rueckmeldung an, die nicht sofort wieder verschwindet', async ({ page }) => {
    await page.goto('/knobel/index.html?debug=1&modus=mauer&stufe=1&seed=1');
    await expect(page.locator('#board.mauer')).toBeVisible();
    await page.locator('#t-hint').click();
    await expect(page.locator('#status')).toContainText('Tipp');
  });

  for (const vp of [{ name: 'iPhone', width: 390, height: 844 }, { name: 'Desktop', width: 1280, height: 800 }]) {
    test(`Rechenzeichen der Zahlenmauer sitzt als Kreis in der Fuge und ist gut lesbar (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/knobel/index.html?debug=1&modus=mauer&stufe=3&seed=1');
      const stone = page.locator('#board.mauer .stone[data-op]').first();
      await expect(stone).toBeVisible();
      const kreis = stone.locator('.stone-op');
      await expect(kreis).toBeVisible();
      const info = await kreis.evaluate((el) => {
        const s = getComputedStyle(el);
        return { size: parseFloat(s.fontSize), weight: parseInt(s.fontWeight, 10), text: el.textContent,
          height: el.getBoundingClientRect().height };
      });
      expect(info.text).toMatch(/^[×+]$/);
      expect(info.weight).toBeGreaterThanOrEqual(700);
      expect(info.height).toBeGreaterThanOrEqual(18);
      // Der Kreis sitzt direkt unter dem Ergebnisstein, der die Fuge zum naechsten
      // Stein darunter markiert: seine Mitte liegt zwischen beiden Steinreihen.
      const steinBox = await stone.boundingBox();
      const kreisBox = await kreis.boundingBox();
      const kreisMitte = kreisBox.y + kreisBox.height / 2;
      expect(kreisMitte).toBeGreaterThan(steinBox.y + steinBox.height * 0.6);
    });

    test(`Rechenzeichen-Kreis ueberdeckt die Zahl im Stein nicht (${vp.name}, groesste Mauer)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/knobel/index.html?debug=1&modus=mauer&stufe=5&seed=1');
      await expect(page.locator('#board.mauer .stone').first()).toBeVisible();
      const overlaps = await page.$$eval('#board.mauer .stone[data-op]', (stones) => stones.filter((el) => {
        const kreis = el.querySelector('.stone-op');
        const text = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        if (!kreis || !text) return false;
        const r = document.createRange(); r.selectNodeContents(text);
        const num = r.getBoundingClientRect(), op = kreis.getBoundingClientRect();
        return num.left < op.right && num.right > op.left && num.top < op.bottom && num.bottom > op.top;
      }).map((el) => el.textContent.trim()));
      expect(overlaps).toEqual([]);
    });
  }

  test.describe('Rechenkaefige: Fuge zwischen Kaefigen gleicher Rechenart (Akzeptanzkriterium 3)', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      test(`Stufe 5 (6x6), seed ${seed}: falls zwei gleichartige Kaefige angrenzen, ist die Fuge sichtbar`, async ({ page }) => {
        await page.goto(`/knobel/index.html?debug=1&modus=kaefige&stufe=5&seed=${seed}`);
        await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
        const paar = await page.evaluate(() => {
          const { puzzle } = window.__knobel.cur, L = window.__knobel.L, n = puzzle.n;
          for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
            const k = L.kaefigFuer(puzzle, r, c);
            if (c + 1 < n) {
              const rechts = L.kaefigFuer(puzzle, r, c + 1);
              if (rechts !== k && rechts.op === k.op) return { a: [r, c], b: [r, c + 1], achse: 'x' };
            }
            if (r + 1 < n) {
              const unten = L.kaefigFuer(puzzle, r + 1, c);
              if (unten !== k && unten.op === k.op) return { a: [r, c], b: [r + 1, c], achse: 'y' };
            }
          }
          return null;
        });
        test.skip(!paar, 'kein angrenzendes Kaefigpaar gleicher Rechenart in diesem Raetsel');
        const elA = page.locator(`#board [data-r="${paar.a[0]}"][data-c="${paar.a[1]}"]`);
        const elB = page.locator(`#board [data-r="${paar.b[0]}"][data-c="${paar.b[1]}"]`);
        const klasseB = await elB.getAttribute('class');
        expect(klasseB.split(' ')).toEqual(expect.arrayContaining([paar.achse === 'x' ? 'fl' : 'ft']));
        const [boxA, boxB] = [await elA.boundingBox(), await elB.boundingBox()];
        const luecke = paar.achse === 'x' ? boxB.x - (boxA.x + boxA.width) : boxB.y - (boxA.y + boxA.height);
        expect(luecke).toBeGreaterThanOrEqual(1.5);
      });
    }
  });

  test.describe('Rechenkaefige: Ziffer ueberlappt den Zeichen-Chip nie (Akzeptanzkriterium 5)', () => {
    for (const vp of [{ name: 'iPhone', width: 390, height: 844 }, { name: 'Desktop', width: 1280, height: 800 }]) {
      for (const stufe of [1, 2, 4, 5]) {
        test(`Stufe ${stufe} (${vp.name})`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(`/knobel/index.html?debug=1&modus=kaefige&stufe=${stufe}&seed=1`);
          await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
          // Alle Felder einmal durchtippen, damit auch die Ziffer selbst (nicht nur der Chip) geprueft wird.
          const plan = await page.evaluate(() => {
            const { puzzle, modus } = window.__knobel.cur, L = window.__knobel.L, out = [];
            for (let r = 0; r < puzzle.n; r++) for (let c = 0; c < puzzle.n; c++)
              if (!L.istFest(modus, puzzle, r, c)) out.push({ r, c, wert: puzzle.loesung[r][c] });
            return out;
          });
          for (const z of plan) {
            await page.locator(`#board [data-r="${z.r}"][data-c="${z.c}"]`).click();
            await page.locator(`#pad .key[data-k="${z.wert}"]`).click();
          }
          const overlaps = await page.$$eval('#board.kaefige .cell', (cells) => cells.filter((el) => {
            const chip = el.querySelector('.chip');
            const text = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
            if (!chip || !text) return false;
            const r = document.createRange(); r.selectNodeContents(text);
            const numBox = r.getBoundingClientRect(), chipBox = chip.getBoundingClientRect();
            const ueberlappt = numBox.left < chipBox.right && numBox.right > chipBox.left &&
              numBox.top < chipBox.bottom && numBox.bottom > chipBox.top;
            return ueberlappt;
          }).map((el) => el.textContent.trim()));
          expect(overlaps).toEqual([]);
        });
      }
    }
  });

  test.describe('Regelkarte ("?") und Mitmach-Tutorial (Akzeptanzkriterium 1)', () => {
    test('"?"-Knopf oeffnet die Regelkarte mit Mini-Beispiel und Tutorial-Knopf', async ({ page }) => {
      await page.goto('/knobel/index.html?debug=1&modus=kaefige&stufe=1&seed=1');
      await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
      await page.locator('#hilfe-knopf').click();
      await expect(page.locator('#hilfe')).toBeVisible();
      await expect(page.locator('#hilfe-beispiel .chip')).toBeVisible();
      await expect(page.locator('#hilfe-beispiel .streifen')).toBeVisible();
      await page.locator('#hilfe-schliessen').click();
      await expect(page.locator('#hilfe')).toBeHidden();
    });

    test('"?"-Taste oeffnet die Regelkarte ebenso (defaultPrevented)', async ({ page }) => {
      await page.goto('/knobel/index.html?debug=1&modus=mauer&stufe=1&seed=1');
      await expect(page.locator('#board.mauer .stone').first()).toBeVisible();
      await page.keyboard.press('?');
      await expect(page.locator('#hilfe')).toBeVisible();
    });

    test('Erster Start der Rechenkaefige zeigt das Tutorial mit allen 5 Schritten im Spec-Wortlaut', async ({ page }) => {
      await page.goto('/knobel/index.html');
      await page.locator('#start-kaefige').click();
      await expect(page.locator('#tutorial')).toBeVisible();
      await expect(page.locator('#tut-text')).toHaveText('In jeder Zeile steht 1, 2 und 3 genau einmal. Genauso in jeder Spalte.');
      await page.locator('#tut-weiter').click();
      await expect(page.locator('#tut-text')).toHaveText('Ein Käfig hat einen farbigen Rand. Das Zeichen sagt, wie gerechnet wird.');
      await page.locator('#tut-weiter').click();
      await expect(page.locator('#tut-text')).toHaveText('Welche zwei Zahlen ergeben malgenommen 6?');
      // interaktiv: "Weiter" ist erst nach der richtigen Eingabe sichtbar
      await expect(page.locator('#tut-weiter')).toBeHidden();
      await page.locator('#tut-beispiel .mini-brett .cell').first().click();
      await page.locator('#tut-beispiel .mini-pad button', { hasText: '2' }).click();
      await page.locator('#tut-beispiel .mini-pad button', { hasText: '3' }).click();
      await expect(page.locator('#tut-weiter')).toBeVisible();
      await page.locator('#tut-weiter').click();
      await expect(page.locator('#tut-text')).toHaveText('Bei − und ÷ steht die größere Zahl vorne.');
      await expect(page.locator('#tut-beispiel .gl')).toContainText('3');
      await page.locator('#tut-weiter').click();
      await expect(page.locator('#tut-text')).toContainText('Ein Käfig mit = verrät dir die Zahl.');
      await page.locator('#tut-weiter').click();
      // Nach dem letzten Schritt startet automatisch das echte Mini-Raetsel.
      await expect(page.locator('#tutorial')).toBeHidden();
      await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
      const gesehen = await page.evaluate(() => JSON.parse(localStorage.getItem('henry_knobel_ui')));
      expect(gesehen.tutorialGesehen.kaefige).toBe(true);
    });

    test('Zweiter Start der Rechenkaefige zeigt das Tutorial nicht mehr', async ({ page }) => {
      await page.goto('/knobel/index.html');
      await page.evaluate(() => localStorage.setItem('henry_knobel_ui', JSON.stringify({ dubletteWarnung: true, tutorialGesehen: { mauer: false, kaefige: true } })));
      await page.reload();
      await page.locator('#start-kaefige').click();
      await expect(page.locator('#tutorial')).toBeHidden();
      await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
    });

    test('Ueberspringen beendet das Tutorial sofort und merkt es sich', async ({ page }) => {
      await page.goto('/knobel/index.html');
      await page.locator('#start-mauer').click();
      await expect(page.locator('#tutorial')).toBeVisible();
      await page.locator('#tut-ueberspringen').click();
      await expect(page.locator('#tutorial')).toBeHidden();
      await expect(page.locator('#board.mauer .stone').first()).toBeVisible();
      const gesehen = await page.evaluate(() => JSON.parse(localStorage.getItem('henry_knobel_ui')));
      expect(gesehen.tutorialGesehen.mauer).toBe(true);
    });

    test('Mauer-Tutorial: beide Schritte sind interaktiv und eindeutig loesbar', async ({ page }) => {
      await page.goto('/knobel/index.html');
      await page.locator('#start-mauer').click();
      await expect(page.locator('#tut-text')).toContainText('Rechne aus: 2 mal 3.');
      await expect(page.locator('#tut-weiter')).toBeHidden();
      await page.locator('#tut-beispiel .mini-pad button', { hasText: '6' }).click();
      await expect(page.locator('#tut-weiter')).toBeVisible();
      await page.locator('#tut-weiter').click();
      await expect(page.locator('#tut-text')).toContainText('3 mal welche Zahl ergibt 12?');
      await page.locator('#tut-beispiel .mini-pad button', { hasText: '4' }).click();
      await expect(page.locator('#tut-weiter')).toBeVisible();
      await page.locator('#tut-weiter').click();
      await expect(page.locator('#tutorial')).toBeHidden();
    });
  });

  test.describe('Rechenstreifen', () => {
    test('ist eine aria-live="polite"-Region und zeigt Platzhaltertext ohne Auswahl', async ({ page }) => {
      await page.goto('/knobel/index.html?debug=1&modus=kaefige&stufe=1&seed=1');
      await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
      const streifen = page.locator('#streifen');
      await expect(streifen).toHaveAttribute('aria-live', 'polite');
      await expect(streifen).toBeVisible();
      await expect(page.locator('#streifen-wort')).toHaveText('Tippe ein leeres Feld an.');
    });

    test('zeigt die Rechnung des gewaehlten Kaefigs mit Luecke und wechselt beim Fertigstellen auf Haekchen', async ({ page }) => {
      await page.goto('/knobel/index.html?debug=1&modus=kaefige&stufe=1&seed=1');
      await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
      const plan = await page.evaluate(() => {
        const { puzzle, modus } = window.__knobel.cur, L = window.__knobel.L;
        for (const k of puzzle.kaefige) {
          if (k.op === '=' || k.zellen.length < 2) continue;
          if (k.zellen.every((z) => !L.istFest(modus, puzzle, z[0], z[1])))
            return k.zellen.map((z) => ({ r: z[0], c: z[1], wert: puzzle.loesung[z[0]][z[1]] }));
        }
        return null;
      });
      test.skip(!plan, 'kein passender Mehrfeld-Kaefig in diesem Raetsel');
      await page.locator(`#board [data-r="${plan[0].r}"][data-c="${plan[0].c}"]`).click();
      await expect(page.locator('#streifen-gl .slot')).not.toHaveCount(0);
      for (const z of plan) {
        await page.locator(`#board [data-r="${z.r}"][data-c="${z.c}"]`).click();
        await page.locator(`#pad .key[data-k="${z.wert}"]`).click();
      }
      await expect(page.locator('#streifen-gl .ok2')).toHaveText('✓');
      await expect(page.locator('#streifen-wort')).toHaveText('Käfig fertig.');
    });

    test('prefers-reduced-motion: Aufleuchten entfaellt, Haekchen und Text bleiben', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/knobel/index.html?debug=1&modus=kaefige&stufe=1&seed=1');
      await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
      const plan = await page.evaluate(() => {
        const { puzzle, modus } = window.__knobel.cur, L = window.__knobel.L;
        for (const k of puzzle.kaefige) {
          if (k.op === '=' || k.zellen.length < 2) continue;
          if (k.zellen.every((z) => !L.istFest(modus, puzzle, z[0], z[1])))
            return k.zellen.map((z) => ({ r: z[0], c: z[1], wert: puzzle.loesung[z[0]][z[1]] }));
        }
        return null;
      });
      test.skip(!plan, 'kein passender Mehrfeld-Kaefig in diesem Raetsel');
      for (const z of plan) {
        await page.locator(`#board [data-r="${z.r}"][data-c="${z.c}"]`).click();
        await page.locator(`#pad .key[data-k="${z.wert}"]`).click();
      }
      const animName = await page.locator('#streifen').evaluate((el) => getComputedStyle(el).animationName);
      expect(animName).toBe('none');
      await expect(page.locator('#streifen-gl .ok2')).toHaveText('✓');
      await expect(page.locator('#streifen-wort')).toHaveText('Käfig fertig.');
    });
  });

  test.describe('Zahlenmauer: gewaehlter Stein markiert seine Quellsteine (Akzeptanzkriterium 6)', () => {
    test('Stufe 3: Quellsteine unter dem gewaehlten Ergebnisstein werden markiert', async ({ page }) => {
      await page.goto('/knobel/index.html?debug=1&modus=mauer&stufe=3&seed=1');
      await expect(page.locator('#board.mauer .stone').first()).toBeVisible();
      const ziel = await page.evaluate(() => {
        const { puzzle, modus } = window.__knobel.cur, L = window.__knobel.L;
        for (let r = 1; r < puzzle.n; r++) for (let c = 0; c < puzzle.n - r; c++)
          if (!L.istFest(modus, puzzle, r, c)) return { r, c };
      });
      await page.locator(`#board [data-r="${ziel.r}"][data-c="${ziel.c}"]`).click();
      const quellen = page.locator(`#board [data-r="${ziel.r - 1}"][data-c="${ziel.c}"].quelle, #board [data-r="${ziel.r - 1}"][data-c="${ziel.c + 1}"].quelle`);
      await expect(quellen).toHaveCount(2);
    });

    test('Umkehraufgabe: fehlt ein unterer Stein, wird das Ergebnis darueber mitmarkiert', async ({ page }) => {
      await page.goto('/knobel/index.html?debug=1&modus=mauer&stufe=1&seed=1');
      await expect(page.locator('#board.mauer .stone').first()).toBeVisible();
      const leererQuellstein = await page.evaluate(() => {
        const { puzzle, modus } = window.__knobel.cur, L = window.__knobel.L, n = puzzle.n;
        for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - r; c++)
          if (!L.istFest(modus, puzzle, r, c)) return { r, c };
      });
      await page.locator(`#board [data-r="${leererQuellstein.r}"][data-c="${leererQuellstein.c}"]`).click();
      const markierte = await page.locator('#board .quelle').count();
      expect(markierte).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Querformat auf dem Telefon (kurze Seite < 560px): Dreh-Hinweis statt Raetsel', () => {
    const { defaultBrowserType, ...geraet } = devices['iPhone 13 landscape'];
    test.use(geraet);
    // Firefox unterstuetzt isMobile-Geraete-Emulation grundsaetzlich nicht
    // (Playwright-Einschraenkung, nichts mit dieser Funktion zu tun).
    test.skip(({ browserName }) => browserName === 'firefox', 'isMobile wird in Firefox nicht unterstuetzt');

    test('zeigt den Dreh-Hinweis und verdeckt das unspielbare Raetsel (Stufe 5, groesste Mauer)', async ({ page }) => {
      await page.goto('/knobel/index.html?debug=1&modus=mauer&stufe=5&seed=1');
      await expect(page.locator('#board.mauer')).toBeAttached();
      await expect(page.locator('#rotate-hint')).toBeVisible();
      await expect(page.locator('#game')).toBeHidden();
      // Die Flaeche hinter dem Hinweis ist nicht erreichbar: der Klick auf die
      // Bildschirmmitte von "Pruefen" trifft den Dreh-Hinweis, nicht den Knopf.
      const getroffen = await page.locator('#t-check').evaluate(btn => {
        const r = btn.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return btn.contains(el);
      });
      expect(getroffen).toBe(false);
    });

    test('Menue selbst bleibt ohne Dreh-Hinweis sichtbar (nur das Raetsel ist betroffen)', async ({ page }) => {
      await page.goto('/knobel/index.html');
      await expect(page.locator('#rotate-hint')).toBeHidden();
      await expect(page.locator('#menu')).toBeVisible();
    });
  });

  test.describe('Querformat auf Tablet/Desktop (kurze Seite >= 560px): weiterhin spielbar', () => {
    const { defaultBrowserType, ...geraet } = devices['iPad (gen 7) landscape'];
    test.use(geraet);
    test.skip(({ browserName }) => browserName === 'firefox', 'isMobile wird in Firefox nicht unterstuetzt');

    test('kein Dreh-Hinweis, Rechenkaefige-Zellen bleiben mindestens 44px (Stufe 5, 6x6)', async ({ page }) => {
      await page.goto('/knobel/index.html?debug=1&modus=kaefige&stufe=5&seed=1');
      await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
      await expect(page.locator('#rotate-hint')).toBeHidden();
      const box = await page.locator('#board.kaefige .cell').first().boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    });

    test('kein Dreh-Hinweis, Zahlenmauer-Steine bleiben mindestens 44px hoch (Stufe 5, groesste Mauer)', async ({ page }) => {
      await page.goto('/knobel/index.html?debug=1&modus=mauer&stufe=5&seed=1');
      await expect(page.locator('#board.mauer')).toBeVisible();
      await expect(page.locator('#rotate-hint')).toBeHidden();
      const box = await page.locator('#board.mauer .stone').first().boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('Tastatur: verarbeitete Tasten rufen preventDefault auf (Firefox-Schnellsuche)', () => {
    test('Ziffern, Rücktaste, Entf und Pfeiltasten sind defaultPrevented', async ({ page }) => {
      await page.goto('/knobel/index.html?debug=1&modus=kaefige&stufe=1&seed=1');
      await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
      await page.locator('#board [data-r="0"][data-c="0"]').click();
      const tasten = ['1', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      for (const taste of tasten) {
        const prevented = await page.evaluate((key) => new Promise((resolve) => {
          document.addEventListener('keydown', (ev) => resolve(ev.defaultPrevented), { once: true, capture: false });
          document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        }), taste);
        expect.soft(prevented, `Taste ${taste}`).toBe(true);
      }
    });
  });

  test.describe('Grenzfall an der 560px-Schwelle (breiter Desktop-Browser, kein Telefon)', () => {
    test('knapp unter der Schwelle (900x559): Dreh-Hinweis greift, bevor Zellen zu klein wuerden', async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 559 });
      await page.goto('/knobel/index.html?debug=1&modus=kaefige&stufe=5&seed=1');
      await expect(page.locator('#board.kaefige .cell').first()).toBeAttached();
      await expect(page.locator('#rotate-hint')).toBeVisible();
    });

    test('knapp ueber der Schwelle (900x560): kein Dreh-Hinweis, Zellen bleiben >= 44px', async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 560 });
      await page.goto('/knobel/index.html?debug=1&modus=kaefige&stufe=5&seed=1');
      await expect(page.locator('#board.kaefige .cell').first()).toBeVisible();
      await expect(page.locator('#rotate-hint')).toBeHidden();
      const box = await page.locator('#board.kaefige .cell').first().boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    });
  });
});
