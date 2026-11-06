import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: 'pwa.spec.ts',
  outputDir: './playwright-report/pwa',
  use: { baseURL: 'http://127.0.0.1:4180', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: false,
  },
})
