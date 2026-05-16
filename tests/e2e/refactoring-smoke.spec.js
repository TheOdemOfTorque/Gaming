const { test, expect } = require('@playwright/test');

// Top-level: no beforeEach — listeners are attached before any navigation.
test('App lädt ohne Console-Errors', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/1x1-trainer/');
  await page.waitForLoadState('networkidle');
  // Clear state and reload to also capture errors during a second boot cycle.
  await page.evaluate(() => localStorage.removeItem('henry_einmaleins'));
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test.describe('with clean state', () => {
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

  test('Migration: v1-State wird beim Boot auf v4 migriert', async ({ page }) => {
    // Inject v1-shaped state (matching real legacy save structure)
    await page.evaluate(() => {
      localStorage.setItem('henry_einmaleins', JSON.stringify({
        _version: 1, name: 'TestKind', xp: 100,
        settings: { grosses1x1: false, inputMode: 'tap', reiheMax: { 1: 20, 2: 20, 3: 20 } },
      }));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    // state is the in-memory app state global, declared as `let state = ...` in the
    // inline <script> of index.html. The refactoring should preserve this global.
    const migrated = await page.evaluate(() => ({
      version: state._version,
      inputMode: state.settings.inputMode,
      hasBlitzConfig: !!state.blitzConfig,
      hasTrainingConfig: !!state.trainingConfig,
      blitzRechenart: state.blitzConfig?.rechenart,
    }));
    expect(migrated.version).toBe(4);
    expect(migrated.inputMode).toBe('both'); // v1->v2 migrates inputMode 'tap' -> 'both'
    expect(migrated.hasBlitzConfig).toBe(true);
    expect(migrated.hasTrainingConfig).toBe(true);
    expect(migrated.blitzRechenart).toBe('mult');
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

  test('logic.js geladen — Funktions-Symbole verfügbar', async ({ page }) => {
    await page.goto('/1x1-trainer/');
    const fns = await page.evaluate(() => ({
      pickBlitzReihe: typeof pickBlitzReihe,
      resolveRechenart: typeof resolveRechenart,
      addBlitzListeEntry: typeof addBlitzListeEntry,
    }));
    expect(fns.pickBlitzReihe).toBe('function');
    expect(fns.resolveRechenart).toBe('function');
    expect(fns.addBlitzListeEntry).toBe('function');
  });
});
