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
    // Firefox hält ein Mausrad-Ziel 1,5 s fest (Wheel Transaction). Tests, die erst hoch
    // und dann runter scrollen, landen sonst am alten Ziel.
    { name: 'firefox', use: { ...devices['Desktop Firefox'],
      launchOptions: { firefoxUserPrefs: { 'mousewheel.transaction.timeout': 0 } } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --directory .`,
    cwd: __dirname,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
