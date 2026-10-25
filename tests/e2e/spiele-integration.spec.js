const { test, expect } = require('@playwright/test');
const { defaultState, migrateState } = require('../../1x1-trainer/logic.js');

// Vollständiger State (über migrateState(defaultState()) statt eines handgebauten
// Teil-Objekts — ein Teil-Objekt ohne z.B. `achievements` lässt updateHomeUI crashen,
// ein vorbestehender Bug unabhängig von dieser Integration, siehe BERICHT.md).
// Streak reicht für Invader/Lumo, 0 Sterne aber wenige Sekunden Stern-Zeit übrig —
// lässt den Timer in Tests schnell ablaufen statt 10 Minuten abzuwarten.
async function seedState(page, over) {
  await page.goto('/1x1-trainer/');
  const base = migrateState(defaultState());
  const seeded = Object.assign({}, base, {
    name: 'TestKind', streak: 5, stars: 0, gameSecondsLeft: 3,
    lastPlayDate: new Date().toDateString(), // Runde heute gespielt -> Knobelwerkstatt frei
    changelogSeenVersion: '2.11',
  }, over);
  await page.evaluate((state) => {
    localStorage.setItem('henry_einmaleins', JSON.stringify(state));
  }, seeded);
  await page.reload();
  await page.waitForLoadState('networkidle');
}

test.describe('Spiele-Integration (Knobelwerkstatt + Lumo)', () => {
  test('Knobelwerkstatt ist ohne Runde am selben Tag gesperrt, auch per openGame', async ({ page }) => {
    await seedState(page, { lastPlayDate: 'Sat Oct 24 2026' });
    const card = page.locator('.game-card[data-game="knobel"]');
    await expect(card.locator('.game-card-sub')).toHaveText('🔒 Erst eine Runde trainieren');
    await expect(card.locator('button')).toBeDisabled();
    await page.evaluate(() => openGame('knobel'));
    await expect(page.locator('#game-overlay')).not.toHaveClass(/active/);
  });

  test('Knobelwerkstatt nach Runde heute: Untertitel "heute frei", keine Stern-Zeit', async ({ page }) => {
    await seedState(page, {});
    const card = page.locator('.game-card[data-game="knobel"]');
    await expect(card.locator('.game-card-sub')).toHaveText('heute frei');
    await expect(card.locator('button')).toBeEnabled();
  });

  test('Knobelwerkstatt im iframe: Ergebnis kommt an, XP steigt, kostet keine Stern-Zeit', async ({ page }) => {
    await seedState(page, { gameSecondsLeft: 0 });
    await page.locator('.game-card[data-game="knobel"] button').click();

    await expect(page.locator('#game-overlay')).toHaveClass(/active/);
    await expect(page.locator('#game-frame')).toHaveAttribute('src', /knobel\/index\.html/);

    await page.frameLocator('#game-frame').locator('body').evaluate(() => {
      window.parent.postMessage(
        { type: 'knobel:result', mode: 'mauer', stufe: 1, tipps: 0, xp: 80, seed: 1 },
        location.origin
      );
    });

    await expect.poll(() => page.evaluate(() => state.xp)).toBe(80);
    const secondsLeft = await page.evaluate(() => state.gameSecondsLeft);
    expect(secondsLeft).toBe(0); // Knobel kostet keine Stern-Zeit

    await page.locator('#game-overlay-close').click();
    await expect(page.locator('#game-overlay')).not.toHaveClass(/active/);
  });

  test('Lumo im iframe: Ergebnis kommt an, XP steigt', async ({ page }) => {
    await seedState(page, { gameSecondsLeft: 600 });
    await page.locator('.game-card[data-game="jnr"] button').click();

    await expect(page.locator('#game-overlay')).toHaveClass(/active/);
    await expect(page.locator('#game-frame')).toHaveAttribute('src', /jumpnrun\/index\.html/);

    await page.frameLocator('#game-frame').locator('body').evaluate(() => {
      window.parent.postMessage(
        { type: 'jnr:result', level: '1-1', medaillen: 2, funken: 10, xp: 30 },
        location.origin
      );
    });

    await expect.poll(() => page.evaluate(() => state.xp)).toBe(30);
    const awarded = await page.evaluate(() => state.jnr.xpAwarded['1-1']);
    expect(awarded).toBe(true);

    await page.locator('#game-overlay-close').click();
    await expect(page.locator('#game-overlay')).not.toHaveClass(/active/);
  });

  test('Lumo-Fortschritt übersteht ein Neuladen des Trainers', async ({ page }) => {
    await seedState(page, { gameSecondsLeft: 600 });
    await page.locator('.game-card[data-game="jnr"] button').click();
    await page.frameLocator('#game-frame').locator('body').evaluate(() => {
      window.parent.postMessage(
        { type: 'jnr:result', level: '1-1', medaillen: 2, funken: 10, xp: 30 },
        location.origin
      );
    });
    await expect.poll(() => page.evaluate(() => state.xp)).toBe(30);
    await page.locator('#game-overlay-close').click();

    await page.reload();
    await page.waitForLoadState('networkidle');

    const [xp, awarded] = await page.evaluate(() => [state.xp, state.jnr.xpAwarded['1-1']]);
    expect(xp).toBe(30);
    expect(awarded).toBe(true);
  });

  test('Timer-Ablauf schließt Lumo automatisch und sendet jnr:timeup', async ({ page }) => {
    await seedState(page, { gameSecondsLeft: 2 });
    await page.locator('.game-card[data-game="jnr"] button').click();
    await expect(page.locator('#game-overlay')).toHaveClass(/active/);

    // sendToGameFrame im Parent abfangen statt im iframe zu lauschen — das iframe
    // wird beim Schließen sofort auf about:blank gesetzt und sein JS-Kontext verworfen.
    await page.evaluate(() => {
      window.__sentMsgs = [];
      const orig = sendToGameFrame;
      sendToGameFrame = function (msg) { window.__sentMsgs.push(msg); return orig(msg); };
    });

    await expect(page.locator('#game-overlay')).not.toHaveClass(/active/, { timeout: 6000 });

    const sent = await page.evaluate(() => window.__sentMsgs);
    expect(sent.some((m) => m && m.type === 'jnr:timeup')).toBe(true);

    const secondsLeft = await page.evaluate(() => state.gameSecondsLeft);
    expect(secondsLeft).toBe(0);
  });

  test('Knobelwerkstatt im iframe: "Zum Trainer"-Link ist nicht sichtbar/klickbar (würde den Trainer im iframe verschachteln)', async ({ page }) => {
    await seedState(page, { gameSecondsLeft: 0 });
    await page.locator('.game-card[data-game="knobel"] button').click();
    await expect(page.locator('#game-overlay')).toHaveClass(/active/);

    const backlink = page.frameLocator('#game-frame').locator('#backlink');
    await expect(backlink).toBeHidden();
  });

  test('Querformat: Schließen-Button des Hosts überlappt Lumos eigenes HUD nicht', async ({ page }) => {
    await seedState(page, { gameSecondsLeft: 600 });
    await page.setViewportSize({ width: 844, height: 390 }); // iPhone 13 Querformat
    await page.locator('.game-card[data-game="jnr"] button').click();
    await expect(page.locator('#game-overlay')).toHaveClass(/active/);

    const frame = page.frameLocator('#game-frame');
    await frame.getByRole('button', { name: /1-1/ }).click();
    const missionText = frame.getByText('Sammle alle Funken');
    await expect(missionText).toBeVisible();

    const closeBox = await page.locator('#game-overlay-close').boundingBox();
    const missionBox = await missionText.boundingBox();
    const overlap = !(
      closeBox.x + closeBox.width <= missionBox.x ||
      missionBox.x + missionBox.width <= closeBox.x ||
      closeBox.y + closeBox.height <= missionBox.y ||
      missionBox.y + missionBox.height <= closeBox.y
    );
    expect(overlap).toBe(false);
  });

  test('Space Invader bleibt unverändert spielbar (Regression)', async ({ page }) => {
    await seedState(page, { gameSecondsLeft: 600 });
    await page.locator('.game-card[data-game="invader"] button').click();
    await expect(page.locator('#space-invader')).toHaveClass(/active/);
    await expect(page.locator('#invader-timer')).toContainText('⏱');
  });
});
