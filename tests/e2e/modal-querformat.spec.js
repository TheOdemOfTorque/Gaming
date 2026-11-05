const { test, expect } = require('@playwright/test');

// Modal-Sheets (Training, Blitz) im Querformat: Das Sheet war höher als der Viewport
// und ließ sich nicht scrollen (Overlay ist position:fixed). Headless Chromium schneidet
// dabei oben ab (Titel und erste Reihen weg), Marcos iPhone unten (letzte Reihen und
// Startknopf weg). Beides löst eine Höhenkappe am Sheet plus overflow-y:auto.
// Hochformat (390x844) bleibt unverändert: dort passt alles ohne Scrollen.

async function frischStarten(page) {
  await page.goto('/1x1-trainer/');
  await page.evaluate(() => localStorage.removeItem('henry_einmaleins'));
  await page.reload();
  const nameInput = page.locator('#name-input');
  if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nameInput.fill('Test');
    await page.click('button:has-text("Los geht")');
  }
}

async function animationAbwarten(locator) {
  await locator.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
}

// Scrollen wie ein Nutzer (Mausrad über dem Sheet) statt scrollIntoView: Letzteres
// scrollt auch overflow:hidden-Container und würde ein nicht scrollbares Sheet
// durchwinken (Review-Befund 28.10.).
async function radScrollen(page, sheet, deltaY) {
  const box = await sheet.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, deltaY);
}

const MODALE = [
  {
    name: 'Training',
    karte: '.mode-card.training',
    modal: '#training-modal',
    start: '#start-training-btn',
    // Startknopf ist disabled, bis eine Reihe gewählt ist. Die erste und die letzte
    // Kachel liegen je nach Browser oben oder unten außerhalb des Viewports; beide
    // müssen nach Scrollen per echtem Klick wählbar sein (Review-Befund 28.10.).
    vorbereiten: async (page, sheet) => {
      for (const [pos, deltaY] of [['first', -3000], ['last', 3000]]) {
        const kachel = page.locator('#reihe-grid .training-reihe-btn')[pos]();
        await radScrollen(page, sheet, deltaY);
        await expect(kachel).toBeInViewport();
        await kachel.click();
      }
      // toggleTrainingReihe rendert das Raster neu, deshalb frisch nachsehen
      await expect(page.locator('#reihe-grid .training-reihe-btn').first()).toHaveClass(/selected/);
      await expect(page.locator('#reihe-grid .training-reihe-btn').last()).toHaveClass(/selected/);
    },
  },
  {
    name: 'Blitz',
    karte: '.mode-card.blitz',
    modal: '#blitz-modal',
    start: '#blitz-start-btn',
    vorbereiten: async () => {},
  },
];

for (const vp of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
  test.describe(`Querformat ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    for (const m of MODALE) {
      test(`${m.name}-Modal: Sheet passt in den Viewport, Titel und Startknopf erreichbar`, async ({ page }) => {
        await frischStarten(page);
        await page.click(m.karte);
        const sheet = page.locator(`${m.modal} .modal-sheet`);
        await expect(sheet).toBeVisible();
        await animationAbwarten(sheet);

        const box = await sheet.boundingBox();
        expect(box.height).toBeLessThanOrEqual(vp.height);
        expect(box.y).toBeGreaterThanOrEqual(0);

        // Titel: nach oben scrollen, dann sichtbar
        const titel = page.locator(`${m.modal} .modal-title`);
        await radScrollen(page, sheet, -3000);
        await expect(titel).toBeInViewport();

        // Startknopf: nach unten scrollen, dann sichtbar und klickbar
        await m.vorbereiten(page, sheet);
        const start = page.locator(m.start);
        await radScrollen(page, sheet, 3000);
        await expect(start).toBeInViewport();
        // Firefox meldet die neue Position erst kurz nach dem Rad-Scrollen, deshalb pollen.
        await expect.poll(async () => {
          const b = await start.boundingBox();
          return b.y >= 0 && b.y + b.height <= vp.height;
        }, { message: 'Startknopf ganz im Bild' }).toBe(true);
        await expect(start).toBeEnabled();
        await start.click();
        await expect(page.locator(m.modal)).not.toHaveClass(/active/);
      });
    }
  });
}

test.describe('Hochformat 390x844 bleibt unverändert', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const m of MODALE) {
    test(`${m.name}-Modal: Startknopf ohne Scrollen sichtbar, Sheet scrollt nicht`, async ({ page }) => {
      await frischStarten(page);
      await page.click(m.karte);
      const sheet = page.locator(`${m.modal} .modal-sheet`);
      await expect(sheet).toBeVisible();
      await animationAbwarten(sheet);
      await expect(page.locator(m.start)).toBeInViewport();
      await expect(page.locator(`${m.modal} .modal-title`)).toBeInViewport();
      const masse = await sheet.evaluate(el => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
      expect(masse.scrollHeight).toBeLessThanOrEqual(masse.clientHeight);
    });
  }
});
