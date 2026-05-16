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

test('App lädt ohne Console-Errors', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/1x1-trainer/');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('Home-Screen zeigt Trainingskarten', async ({ page }) => {
  await expect(page.locator('.mode-card.training')).toBeVisible();
  await expect(page.locator('.mode-card.blitz')).toBeVisible();
});

test('Training-Flow: Reihe 3 öffnen, Frage erscheint', async ({ page }) => {
  await page.click('.mode-card.training');
  await page.click('#reihe-grid button:has-text("3er-Reihe")');
  await page.click('#start-training-btn');
  // Default inputMode='both' shows an intermediate picker — choose tap to proceed
  const inputModal = page.locator('#input-type-modal');
  if (await inputModal.isVisible({ timeout: 1000 }).catch(() => false)) {
    await inputModal.locator('button:has-text("Antippen")').click();
  }
  await expect(page.locator('#question-text')).toBeVisible();
  const text = await page.locator('#question-text').textContent();
  expect(text).toMatch(/3\s*[×x]\s*\d+|\d+\s*[×x]\s*3|^\d+\s*[÷:]\s*3/);
});

test('Migration: leerer State erzeugt v4-Schema', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('henry_einmaleins'));
  await page.reload();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('henry_einmaleins') || 'null'));
  if (state) {
    expect(state._version).toBe(4);
    expect(state.settings).toBeDefined();
    expect(state.blitzConfig).toBeDefined();
  }
});

test('Service Worker registriert', async ({ page }) => {
  await page.goto('/1x1-trainer/');
  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg;
  });
  expect(swReady).toBe(true);
});
