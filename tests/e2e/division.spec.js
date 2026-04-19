const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/1x1-trainer/');
  await page.evaluate(() => localStorage.removeItem('henry_einmaleins'));
  await page.reload();
  const nameInput = page.locator('#name-input');
  if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nameInput.fill('Test');
    await page.click('button:has-text("Los geht")');
  }
});

test('Blitz-Picker zeigt Rechenart-Toggle', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await expect(page.locator('#blitz-rechenart-toggle')).toBeVisible();
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="mult"]')).toBeVisible();
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="div"]')).toBeVisible();
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="gemischt"]')).toBeVisible();
});

test('Blitz-Picker: Mult ist Standard-Rechenart', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="mult"]')).toHaveClass(/active-blitz/);
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="div"]')).not.toHaveClass(/active-blitz/);
});

test('Blitz-Picker: Rechenart-Wahl wird im Start-Button angezeigt', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await page.click('#blitz-rechenart-toggle .rechenart-btn[data-r="div"]');
  await expect(page.locator('#blitz-start-btn')).toContainText('÷');
});

test('Blitz-Picker: Rechenart wird persistent gespeichert', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await page.click('#blitz-rechenart-toggle .rechenart-btn[data-r="gemischt"]');
  await page.click('#blitz-modal .btn-secondary');
  await page.click('.mode-card.blitz');
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="gemischt"]')).toHaveClass(/active-blitz/);
});

test('Turnier-Karte öffnet Turnier-Picker', async ({ page }) => {
  await page.click('.mode-card.turnier');
  await expect(page.locator('#turnier-modal')).toBeVisible();
  await expect(page.locator('#turnier-rechenart-toggle')).toBeVisible();
});

test('Turnier-Picker: Mult ist Standard-Rechenart', async ({ page }) => {
  await page.click('.mode-card.turnier');
  await expect(page.locator('#turnier-rechenart-toggle .rechenart-btn[data-r="mult"]')).toHaveClass(/active-turnier/);
});

test('Training-Picker zeigt Rechenart-Toggle', async ({ page }) => {
  await page.click('.mode-card.training');
  await expect(page.locator('#training-rechenart-toggle')).toBeVisible();
  await expect(page.locator('#training-rechenart-toggle .rechenart-btn[data-r="mult"]')).toHaveClass(/active-training/);
});

test('Training-Picker: Reihen zeigen Dual-Progress-Zeilen', async ({ page }) => {
  await page.click('.mode-card.training');
  const firstCard = page.locator('#reihe-grid button').first();
  await expect(firstCard).toContainText('×');
  await expect(firstCard).toContainText('÷');
});
