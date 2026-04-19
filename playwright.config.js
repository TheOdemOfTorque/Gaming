const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8080',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'python3 -m http.server 8080 --directory /Users/marco/dev/gaming/.worktrees/feature-blitz',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
