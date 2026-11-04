// Der Standardlauf darf nur localhost erreichen. Sonst landet ein vergessener
// Mock still im Produktions-Backend (siehe multiplayer.mocked.spec.js).
const { test, expect } = require('@playwright/test');

test.skip(!!process.env.PW_PROD, 'Mit PW_PROD=1 ist das Netz bewusst offen.');

test('Fremde Hosts sind im Standardlauf nicht erreichbar', async ({ page }) => {
  await page.goto('/1x1-trainer/');
  const ergebnis = await page.evaluate(async () => {
    try {
      await fetch('https://example.com/', { mode: 'no-cors', cache: 'no-store' });
      return 'erreicht';
    } catch (e) {
      return 'gesperrt';
    }
  });
  expect(ergebnis).toBe('gesperrt');
});

test('localhost bleibt erreichbar', async ({ page }) => {
  const antwort = await page.request.get('/1x1-trainer/');
  expect(antwort.ok()).toBeTruthy();
});
