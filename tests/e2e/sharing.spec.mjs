import { test, expect } from '@playwright/test'

const LIVE_ORIGIN = 'https://mattbat.com'

// null when the tag isn't there (rather than waiting for it to appear).
const content = (page, selector) => page.evaluate((s) => document.querySelector(s)?.getAttribute('content') ?? null, selector)
const meta = (page, property) => content(page, `meta[property="${property}"]`)
const named = (page, name) => content(page, `meta[name="${name}"]`)

// "https://mattbat.com/cookbook/img/gumbo.jpeg" -> the same file on the test server.
const onTestServer = (page, url) => url.replace(LIVE_ORIGIN, new URL(page.url()).origin)

test.describe('a shared recipe link', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('recipes/gumbo/')
  })

  test('gets the recipe name and the real address', async ({ page }) => {
    await expect(page).toHaveTitle('Gumbo')
    expect(await meta(page, 'og:title')).toBe('Gumbo')
    expect(await meta(page, 'og:type')).toBe('article')
    expect(await meta(page, 'og:url')).toBe('https://mattbat.com/cookbook/recipes/gumbo/')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://mattbat.com/cookbook/recipes/gumbo/')
  })

  test('shows the recipe photo, and the photo really loads', async ({ page }) => {
    const image = await meta(page, 'og:image')
    expect(image).toBe('https://mattbat.com/cookbook/img/gumbo.jpeg')
    expect(await meta(page, 'og:image:alt')).toBeTruthy()
    expect(await named(page, 'twitter:image')).toBe(image)
    expect(await named(page, 'twitter:card')).toBe('summary_large_image')

    const response = await page.request.get(onTestServer(page, image))
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/^image\//)
    expect((await response.body()).length).toBeGreaterThan(1000)
  })

  test('description is about the recipe, not the page header', async ({ page }) => {
    const description = await meta(page, 'og:description')
    expect(description).toMatch(/Gumbo|cooked chicken/)
    expect(description).not.toMatch(/^Cookbook/)
    expect(description).not.toMatch(/Toggle navigation|By:|serving\(s\)/)
    expect(description.length).toBeLessThanOrEqual(160)
    expect(await named(page, 'description')).toBe(description)
    expect(await named(page, 'twitter:description')).toBe(description)
  })
})

test('pages without a photo do not point at a missing picture', async ({ page }) => {
  await page.goto('./')
  expect(await meta(page, 'og:type')).toBe('website')
  expect(await meta(page, 'og:description')).toBeTruthy()
  for (const image of [await meta(page, 'og:image'), await named(page, 'twitter:image')]) {
    if (image === null) continue
    const response = await page.request.get(onTestServer(page, image))
    expect(response.status(), image).toBe(200)
  }
})
