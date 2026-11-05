import { defineConfig, devices } from '@playwright/test'

const CI = !!process.env.CI
// Set PORT to run several copies of the tests side by side.
const PORT = Number(process.env.PORT || 8080)

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}/cookbook/`,
    trace: 'retain-on-failure',
    // The offline copy (service worker) is tested on its own in pwa.spec.mjs; elsewhere it would
    // hide requests from the tests
    serviceWorkers: 'block',
    screenshot: 'only-on-failure'
  },
  // Every test runs on an iPhone (Safari engine), an Android phone (Chrome engine) and a desktop.
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }
  ],
  // Builds and serves the real site. If `npm start` is already running on that port, that is used instead.
  webServer: {
    command: 'npm run build --silent && node tests/serve.mjs',
    url: `http://localhost:${PORT}/cookbook/`,
    reuseExistingServer: !CI,
    timeout: 120_000
  }
})
