const { defineConfig } = require('@playwright/test');
const PORT = process.env.PW_PORT || 8080;
module.exports = defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    // Service Worker blockieren — sonst gehen Fetches durch den SW-Context und
    // bypassen page.route(). Wichtig für mocked E2E (Issue #28 Strategie B).
    serviceWorkers: 'block',
  },
  webServer: {
    command: `python3 -m http.server ${PORT} --directory .`,
    cwd: __dirname,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
