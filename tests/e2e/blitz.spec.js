const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/1x1-trainer/');
  await page.evaluate(() => localStorage.removeItem('henry_einmaleins'));
  await page.reload();
  // If name screen appears, fill it in
  const nameInput = page.locator('#name-input');
  if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nameInput.fill('Test');
    await page.click('button:has-text("Los geht")');
  }
});

// Helper: call toggleBlitzReihe(n) directly in the page context.
// Clicking the button element via DOM doesn't work on disabled buttons.
async function selectReihe(page, nth) {
  await page.evaluate((n) => {
    const btns = document.querySelectorAll('#blitz-reihe-grid .blitz-reihe-btn');
    // Call the app's toggleBlitzReihe function directly, passing the button element
    toggleBlitzReihe(n + 1, btns[n]);
  }, nth);
}

test('Blitz-Karte öffnet Reihen-Picker', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await expect(page.locator('#blitz-modal')).toBeVisible();
});

test('Alle-Reihen ist nach erstem Start vorausgewählt', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await expect(page.locator('#blitz-alle-btn')).toHaveClass(/selected/);
});

test('Reihe auswählen deaktiviert Alle-Reihen-Toggle', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await selectReihe(page, 0); // 1er — also sets alleReihen=false
  await expect(page.locator('#blitz-alle-btn')).not.toHaveClass(/selected/);
});

test('Maximal 4 Reihen auswählbar — 5. verdrängt älteste', async ({ page }) => {
  await page.click('.mode-card.blitz');
  for (let i = 0; i < 5; i++) await selectReihe(page, i); // 1er–5er
  const btns = page.locator('#blitz-reihe-grid .blitz-reihe-btn');
  await expect(btns.nth(0)).not.toHaveClass(/selected/);
  await expect(btns.nth(4)).toHaveClass(/selected/);
  await expect(page.locator('#blitz-reihe-grid .blitz-reihe-btn.selected')).toHaveCount(4);
});

test('Start-Button zeigt gewählte Reihen an', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await selectReihe(page, 2); // 3er
  await selectReihe(page, 4); // 5er
  await expect(page.locator('#blitz-start-btn')).toContainText('3er');
  await expect(page.locator('#blitz-start-btn')).toContainText('5er');
});

test('Letzte Konfiguration wird beim erneuten Öffnen wiederhergestellt', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await selectReihe(page, 2); // 3er
  await page.click('#blitz-modal .btn-secondary'); // Abbrechen
  await page.click('.mode-card.blitz');
  await expect(page.locator('#blitz-reihe-grid .blitz-reihe-btn').nth(2)).toHaveClass(/selected/);
});

test('Highscore-Seite ist über Hauptmenü erreichbar', async ({ page }) => {
  await page.click('text=Blitz-Rekorde');
  await expect(page.locator('#screen-blitz-highscores')).toBeVisible();
  await expect(page.locator('text=Noch keine Blitz-Runde gespielt')).toBeVisible();
});
