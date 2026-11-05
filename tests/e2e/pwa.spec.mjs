import { test, expect } from '@playwright/test'

// The cookbook as an app: installing it on the home screen, and using it without signal.

test.describe('works without signal', () => {
  test.use({ serviceWorkers: 'allow' })

  // The first visit installs the offline copy; pages are saved from then on.
  async function installOfflineCopy (page) {
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  }

  test('a recipe you opened before still opens offline, with its photo', async ({ page, context }) => {
    await page.goto('recipes/gumbo/')
    await installOfflineCopy(page)
    await expect(page.locator('.recipe-photo img')).toBeVisible()
    await page.waitForFunction(() => document.querySelector('.recipe-photo img').complete)

    await context.setOffline(true)
    await page.reload()
    await expect(page.locator('h1')).toHaveText('Gumbo')
    await expect(page.locator('.recipe-ingredients li').first()).toContainText('cooked chicken')
    expect(await page.locator('.recipe-photo img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)
    // Kitchen tools still work
    await page.getByRole('button', { name: 'More servings' }).click()
    await expect(page.locator('.recipe-ingredients li').first()).toHaveText(/^2¼ cups/)
  })

  test('a recipe you haven\'t opened shows the offline page, listing the saved ones', async ({ page, context }) => {
    await page.goto('recipes/gumbo/')
    await installOfflineCopy(page)
    await context.setOffline(true)
    await page.goto('recipes/brisket/')
    await expect(page.locator('h1')).toHaveText('You’re offline')
    const saved = page.locator('[data-saved] a')
    await expect(saved).toHaveText(['Gumbo'])
    await saved.click()
    await expect(page.locator('h1')).toHaveText('Gumbo')
  })

  test('search works offline', async ({ page, context }) => {
    await page.goto('./')
    await installOfflineCopy(page)
    await context.setOffline(true)
    await page.goto('search/?q=roux')
    await expect(page.locator('[data-search][data-ready]')).toBeAttached()
    await expect(page.locator('[data-results] .card:not([hidden]) .card-title').first()).toBeVisible()
    await expect(page.locator('[data-results] .card:not([hidden]) .card-title')).toContainText(['Gumbo'])
  })

  test('online, pages are always fresh rather than the saved copy', async ({ page, context }) => {
    await page.goto('recipes/gumbo/')
    await installOfflineCopy(page)
    // context.route also sees the requests the offline copy makes
    await context.route('**/recipes/gumbo/', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Gumbo</title><h1>Updated gumbo</h1>'
    }))
    await page.reload()
    await expect(page.locator('h1')).toHaveText('Updated gumbo')
  })
})

test.describe('add to home screen', () => {
  // What Android and desktop Chrome send when the site can be installed
  const offerInstall = (page) => page.evaluate(() => {
    const event = new Event('beforeinstallprompt')
    event.prompt = () => { window.__prompted = true }
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(event)
  })
  const banner = (page) => page.locator('.install')

  test('the page says it can be installed, with an icon', async ({ page }) => {
    await page.goto('./')
    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href')
    const response = await page.request.get(manifest)
    expect(response.ok()).toBe(true)
    const icon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
    expect((await page.request.get(icon)).headers()['content-type']).toContain('image/png')
  })

  test('Chrome: an Install button appears, and installing hides the card', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome only')
    await page.goto('./')
    await expect(banner(page)).toBeHidden()
    await offerInstall(page)
    await expect(banner(page)).toBeVisible()
    await banner(page).getByRole('button', { name: 'Install' }).click()
    expect(await page.evaluate(() => window.__prompted)).toBe(true)
    await expect(banner(page)).toBeHidden()
  })

  test('Not now hides the card for good', async ({ page, browserName }) => {
    await page.goto('./')
    if (browserName === 'chromium') await offerInstall(page)
    await expect(banner(page)).toBeVisible()
    await banner(page).getByRole('button', { name: 'Not now' }).click()
    await expect(banner(page)).toBeHidden()
    await page.reload()
    if (browserName === 'chromium') await offerInstall(page)
    await expect(banner(page)).toBeHidden()
  })

  test('iPhone: explains Share, then Add to Home Screen', async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== 'webkit' || !isMobile, 'iPhone only')
    await page.goto('./')
    await expect(banner(page)).toBeVisible()
    await expect(banner(page)).toContainText('Add to Home Screen')
    await expect(banner(page).getByRole('button', { name: 'Install' })).toBeHidden()
  })

  test('only on the home page', async ({ page, browserName }) => {
    await page.goto('recipes/gumbo/')
    if (browserName === 'chromium') await offerInstall(page)
    await expect(banner(page)).toHaveCount(0)
  })

  test('the app\'s own Back button stays hidden in a normal browser tab', async ({ page }) => {
    await page.goto('recipes/gumbo/')
    await expect(page.locator('.topbar .back')).toBeHidden()
  })
})
