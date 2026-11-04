import { defineConfig, devices } from '@playwright/test'

const CI = !!process.env.CI

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8080/cookbook/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  // Every test runs on an iPhone (Safari engine), an Android phone (Chrome engine) and a desktop.
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }
  ],
  // Builds and serves the real site. If `npm start` is already running on 8080, that is used instead.
  webServer: {
    command: 'npm run build --silent && node tests/serve.mjs',
    url: 'http://localhost:8080/cookbook/',
    reuseExistingServer: !CI,
    timeout: 120_000
  }
})
