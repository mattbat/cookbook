import { test, expect } from '@playwright/test'

const PAGES = ['./', 'search/', 'list/', 'tags/', 'recipes/gumbo/', 'recipes/brisket/', 'recipes/new-york-cheesecake/']

for (const path of PAGES) {
  test(`${path} doesn't scroll sideways`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('load')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test.describe('on phones', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone-only checks')

  test('pinch-to-zoom is allowed', async ({ page }) => {
    await page.goto('recipes/gumbo/')
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).not.toMatch(/maximum-scale=1(\.0)?\b|user-scalable=no/)
  })

  test('servings buttons are big enough for a finger (44px)', async ({ page }) => {
    await page.goto('recipes/gumbo/')
    for (const button of await page.locator('.recipe-scaling button').all()) {
      const box = await button.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })
})

// Photos without a size make the page jump as they load, which sent category links to the wrong place.
test('photos reserve their space before loading', async ({ page }) => {
  await page.goto('tags/')
  const unsized = await page.locator('img:not([width]), img:not([height])').count()
  expect(unsized).toBe(0)
})

test('a category link lands on its heading even on a slow connection', async ({ page }) => {
  // Hold photos back for a second, like a phone on a weak signal.
  await page.route('**/img/*.jpeg', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await route.continue()
  })
  await page.goto('tags/#soup')
  await page.waitForLoadState('load')
  const top = await page.locator('h2#soup').evaluate((el) => el.getBoundingClientRect().top)
  // Not hidden behind the fixed navbar
  const navBottom = await page.locator('.topbar').evaluate((el) => el.getBoundingClientRect().bottom)
  expect(top).toBeGreaterThanOrEqual(navBottom)
  expect(top).toBeLessThan(200)
})

test('recipe cards all have the same photo shape', async ({ page }) => {
  await page.goto('tags/')
  const ratios = await page.locator('.card-photo').evaluateAll((photos) =>
    photos.slice(0, 12).map((el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height))
  for (const ratio of ratios) expect(ratio).toBeCloseTo(4 / 3, 1)
})

test('the bottom tabs never cover the end of the page', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only')
  await page.goto('recipes/gumbo/')
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
  const footer = await page.locator('.footer').boundingBox()
  const tabs = await page.locator('.tabbar').boundingBox()
  expect(footer.y + footer.height).toBeLessThanOrEqual(tabs.y + 1)
})

test('follows the phone or computer dark mode setting', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('recipes/gumbo/')
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const [r, g, b] = background.match(/\d+/g).map(Number)
  expect(r + g + b).toBeLessThan(150)
})
