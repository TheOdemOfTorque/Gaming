// Offline-Verhalten der installierten Trainer-PWA mit den eingebetteten Spielen.
// Hier laufen die Service Worker wirklich (playwright.config blockiert sie sonst).
// Netz nur localhost: alles andere wird abgebrochen, mp bleibt aus (defaultState).
const { test, expect } = require('@playwright/test');
const { defaultState, migrateState } = require('../../1x1-trainer/logic.js');

test.use({ serviceWorkers: 'allow' });
test.skip(({ browserName }) => browserName !== 'chromium', 'Service-Worker-Offline-Tests nur in Chromium');

const CACHES = ['1x1-trainer-v28', 'knobel-v9', 'jumpnrun-v1'];

test.beforeEach(async ({ context }) => {
  await context.route((url) => url.hostname !== 'localhost', (route) => route.abort());
});

async function seed(page, over) {
  await page.goto('/1x1-trainer/');
  const s = Object.assign(migrateState(defaultState()), {
    name: 'TestKind', streak: 5, stars: 2, gameSecondsLeft: 0,
    lastRoundDate: new Date().toDateString(), lastPlayDate: new Date().toDateString(),
    changelogSeenVersion: '9.9',
  }, over);
  expect(s.mp.enabled).toBe(false);
  await page.evaluate((st) => localStorage.setItem('henry_einmaleins', JSON.stringify(st)), s);
  await page.reload();
}

const cacheNamen = (page) => page.evaluate(async () => (await caches.keys()).sort());

async function wartenBisAlleSwAktiv(page) {
  await expect.poll(() => page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations())
      .filter((r) => r.active && r.active.state === 'activated')
      .map((r) => new URL(r.scope).pathname).sort()
  ), { timeout: 15000 }).toEqual(['/1x1-trainer/', '/jumpnrun/', '/knobel/']);
  await expect.poll(() => cacheNamen(page), { timeout: 15000 }).toEqual([...CACHES].sort());
}

async function offlineOhneHttpCache(context, page) {
  // Ohne HTTP-Cache, damit wirklich nur die Service Worker ausliefern.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await context.setOffline(true);
}

test('H1: Knobel öffnen löscht den Trainer-Cache nicht, Trainer startet danach offline', async ({ page, context }) => {
  await seed(page, {});
  await wartenBisAlleSwAktiv(page);

  await page.evaluate(() => openGame('knobel'));
  await expect.poll(() => page.evaluate(() => {
    const w = document.getElementById('game-frame').contentWindow;
    return !!(w && w.KnobelLogic && w.navigator.serviceWorker.controller);
  }), { timeout: 10000 }).toBe(true);
  await page.waitForTimeout(500); // activate des Knobel-SW hätte hier schon geräumt
  expect(await cacheNamen(page)).toEqual([...CACHES].sort());
  await page.evaluate(() => closeGame());

  await offlineOhneHttpCache(context, page);
  await page.reload();
  await expect(page.locator('#screen-home')).toHaveClass(/active/);
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
});

test('M1: Lumo läuft offline im Trainer, der Stern wird erst nach dem Laden abgezogen', async ({ page, context }) => {
  await seed(page, { stars: 2, gameSecondsLeft: 0 });
  await wartenBisAlleSwAktiv(page);

  await offlineOhneHttpCache(context, page);
  await page.reload();
  await expect(page.locator('#screen-home')).toHaveClass(/active/);

  await page.evaluate(() => openGame('jnr'));
  const frame = page.frameLocator('#game-frame');
  await expect(frame.locator('#menu')).toBeVisible({ timeout: 10000 });
  // N2: der Knopf nennt keine feste Reihe mehr (die wählt das Kind vor dem Start)
  await expect(frame.locator('button[data-level="1-2"] small')).toHaveText('Reihe wählst du vor dem Start');
  expect(await page.evaluate(() => {
    const w = document.getElementById('game-frame').contentWindow;
    return !!(w.JNR && w.JNR.host && w.JNR.levels && w.navigator.serviceWorker.controller);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => [state.stars, state.gameSecondsLeft > 590])).toEqual([1, true]);
  await expect(page.locator('#game-overlay')).toHaveClass(/active/);
});

test('M1: fehlt Lumo offline im Cache, kostet das Öffnen keinen Stern', async ({ page, context }) => {
  await seed(page, { stars: 2, gameSecondsLeft: 0 });
  await wartenBisAlleSwAktiv(page);
  // Lumos SW und Cache weg (z.B. Speicher geräumt), Trainer bleibt offline-fähig
  await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) {
      if (new URL(r.scope).pathname === '/jumpnrun/') await r.unregister();
    }
    for (const k of await caches.keys()) if (k.startsWith('jumpnrun-') || k.startsWith('1x1-trainer-')) {
      // Trainer-Cache ohne Lumo-Reserve: nur die Lumo-Einträge entfernen
      const c = await caches.open(k);
      for (const req of await c.keys()) if (new URL(req.url).pathname.startsWith('/jumpnrun/')) await c.delete(req);
    }
  });

  await offlineOhneHttpCache(context, page);
  await page.reload();
  // Registrierung durch den Trainer schlägt offline fehl, das darf nichts kaputt machen
  await expect(page.locator('#screen-home')).toHaveClass(/active/);

  await page.evaluate(() => openGame('jnr'));
  await expect(page.locator('#game-overlay')).not.toHaveClass(/active/, { timeout: 10000 });
  await expect(page.getByText('braucht einmal Internet')).toBeVisible();
  expect(await page.evaluate(() => [state.stars, state.gameSecondsLeft])).toEqual([2, 0]);
});
