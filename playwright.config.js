const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8080',
    viewport: { width: 390, height: 844 },
    // Service Worker blockieren — sonst gehen Fetches durch den SW-Context und
    // bypassen page.route(). Wichtig für mocked E2E (Issue #28 Strategie B).
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'python3 -m http.server 8080 --directory .',
    cwd: __dirname,
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
