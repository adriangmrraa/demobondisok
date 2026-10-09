import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  // Un solo worker: los tests de mapa (WebGL en Chromium y WebKit) compiten por GPU/CPU y en paralelo se vuelven flaky.
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:3000/inicio',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
