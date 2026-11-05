const { test, expect } = require('@playwright/test');
const { defaultState, migrateState } = require('../../1x1-trainer/logic.js');

// Spielkarten auf dem Home-Screen (.games-bar-cards): Untertitel müssen lesbar sein
// (mind. 12px, Deckkraft >= 0.65), dürfen bei 320/375/390 px Breite und im Querformat
// nicht abgeschnitten werden, und die drei Karten bleiben gleich hoch mit Knöpfen auf
// einer Linie. Ein Seed-State je Untertitel-Variante; mp.enabled bleibt false, sonst
// würde der Produktionsserver angerufen.

const HEUTE = new Date().toDateString();

const ZUSTAENDE = {
  // invader/jnr: "🔒 ab 3 Tagen Streak (0)", knobel: "🔒 Erst ein Training durchspielen"
  'streak-und-runde-gesperrt': { streak: 0, stars: 0, gameSecondsLeft: 0, lastRoundDate: null },
  // invader/jnr: "🔒 keine Sterne übrig", knobel: "heute frei"
  'keine-sterne':              { streak: 5, stars: 0, gameSecondsLeft: 0, lastRoundDate: HEUTE },
  // invader/jnr: "⭐⭐ · 20 min", knobel: "🔒 Erst ein Training durchspielen"
  'zwei-sterne-keine-runde':   { streak: 5, stars: 2, gameSecondsLeft: 0, lastRoundDate: null },
  // invader/jnr: "⭐⭐⭐⭐⭐ ×7 · 72 min", knobel: "heute frei"
  'viele-sterne':              { streak: 5, stars: 7, gameSecondsLeft: 90, lastRoundDate: HEUTE },
};

async function seedState(page, over) {
  await page.goto('/1x1-trainer/');
  const base = migrateState(defaultState());
  const seeded = Object.assign({}, base, {
    name: 'TestKind', lastPlayDate: HEUTE, changelogSeenVersion: '9.9',
  }, over);
  if (seeded.mp.enabled) throw new Error('mp.enabled muss im Test false bleiben');
  await page.evaluate((state) => {
    localStorage.setItem('henry_einmaleins', JSON.stringify(state));
  }, seeded);
  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function kartenMasse(page) {
  return page.evaluate(() => {
    const karten = [...document.querySelectorAll('.games-bar-cards .game-card')];
    return karten.map(k => {
      const sub = k.querySelector('.game-card-sub');
      const btn = k.querySelector('.game-card-btn');
      const cs = getComputedStyle(sub);
      const m = cs.color.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+))?\s*\)/);
      return {
        game: k.dataset.game,
        text: sub.textContent,
        fontPx: parseFloat(cs.fontSize),
        alpha: m && m[1] !== undefined ? parseFloat(m[1]) : 1,
        subScrollW: sub.scrollWidth, subClientW: sub.clientWidth,
        kartScrollW: k.scrollWidth, kartClientW: k.clientWidth,
        kartH: k.getBoundingClientRect().height,
        btnBottom: btn.getBoundingClientRect().bottom,
      };
    });
  });
}

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Spielkarten ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    for (const [name, over] of Object.entries(ZUSTAENDE)) {
      test(`${name}: Untertitel lesbar, nicht abgeschnitten, Karten gleich hoch`, async ({ page }) => {
        await seedState(page, over);
        await expect(page.locator('.games-bar-cards .game-card')).toHaveCount(3);
        const karten = await kartenMasse(page);
        for (const k of karten) {
          expect(k.fontPx, `${k.game} Schriftgröße`).toBeGreaterThanOrEqual(12);
          expect(k.alpha, `${k.game} Deckkraft`).toBeGreaterThanOrEqual(0.65);
          expect(k.subScrollW, `${k.game} Untertitel "${k.text}" läuft über`).toBeLessThanOrEqual(k.subClientW);
          expect(k.kartScrollW, `${k.game} Karte läuft über`).toBeLessThanOrEqual(k.kartClientW);
        }
        const hoehen = karten.map(k => k.kartH);
        expect(Math.max(...hoehen) - Math.min(...hoehen), 'Kartenhöhen').toBeLessThanOrEqual(1);
        const unten = karten.map(k => k.btnBottom);
        expect(Math.max(...unten) - Math.min(...unten), 'Knöpfe auf einer Linie').toBeLessThanOrEqual(1);
      });
    }
  });
}
