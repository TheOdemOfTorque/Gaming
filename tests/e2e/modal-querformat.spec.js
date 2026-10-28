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

const MODALE = [
  {
    name: 'Training',
    karte: '.mode-card.training',
    modal: '#training-modal',
    start: '#start-training-btn',
    // Startknopf ist disabled, bis eine Reihe gewählt ist; Reihe 1 liegt vorher
    // außerhalb des Viewports, deshalb per Funktion statt per Klick wählen.
    vorbereiten: page => page.evaluate(() => toggleTrainingReihe(1)),
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
        await titel.scrollIntoViewIfNeeded();
        await expect(titel).toBeInViewport();

        // Startknopf: nach unten scrollen, dann sichtbar und klickbar
        await m.vorbereiten(page);
        const start = page.locator(m.start);
        await start.scrollIntoViewIfNeeded();
        await expect(start).toBeInViewport();
        const b = await start.boundingBox();
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
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
