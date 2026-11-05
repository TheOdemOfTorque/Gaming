const { defineConfig, devices } = require('@playwright/test');
const PORT = process.env.PW_PORT || 8080;
// Standardlauf: nur localhost. multiplayer.spec.js schreibt in die echte
// Produktions-Datenbank und läuft nur bewusst mit PW_PROD=1.
const PROD = !!process.env.PW_PROD;
module.exports = defineConfig({
  testDir: './tests/e2e',
  testIgnore: PROD ? [] : ['**/multiplayer.spec.js'],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    // Service Worker blockieren — sonst gehen Fetches durch den SW-Context und
    // bypassen page.route(). Wichtig für mocked E2E (Issue #28 Strategie B).
    serviceWorkers: 'block',
    // Alles außer localhost geht an einen geschlossenen Port und scheitert.
    // page.route() greift vorher, Mocks funktionieren also weiter.
    ...(PROD ? {} : { proxy: { server: 'http://127.0.0.1:9', bypass: 'localhost,127.0.0.1' } }),
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Playwright-Firefox hängt gelegentlich 30 s in evaluate/click, unter Last häufiger
    // (05.11.: 6 von 219 im Lauf mit drei Engines, einzeln 1 von 78). Wiederholte Tests
    // meldet Playwright als „flaky“.
    { name: 'firefox', retries: 2, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --directory .`,
    cwd: __dirname,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
