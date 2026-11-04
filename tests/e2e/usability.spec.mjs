import { test, expect } from '@playwright/test'

const PAGES = ['./', 'list/', 'tags/', 'recipes/gumbo/', 'recipes/brisket/', 'recipes/new-york-cheesecake/']

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

  // Known issues, to fix in Phase 1 (remove `.fail` once fixed).
  test.fail('pinch-to-zoom is allowed', async ({ page }) => {
    await page.goto('recipes/gumbo/')
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).not.toMatch(/maximum-scale=1(\.0)?\b|user-scalable=no/)
  })

  test.fail('servings buttons are big enough for a finger (44px)', async ({ page }) => {
    await page.goto('recipes/gumbo/')
    for (const button of await page.locator('.recipe-scaling button').all()) {
      const box = await button.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })
})

// Known issue, to fix in Phase 1: photos without a size make the page jump as they load,
// which is why tapping a category lands in the wrong place.
test.fail('photos reserve their space before loading', async ({ page }) => {
  await page.goto('tags/')
  const unsized = await page.locator('img:not([width]), img:not([height])').count()
  expect(unsized).toBe(0)
})

test('a category link lands on its heading even on a slow connection', async ({ page, browserName }) => {
  // Safari happens to cope; Chrome (Android and desktop) jumps to the wrong place.
  test.fail(browserName === 'chromium', 'Phase 1')
  // Hold photos back for a second, like a phone on a weak signal.
  await page.route('**/img/*.jpeg', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await route.continue()
  })
  await page.goto('tags/#soup')
  await page.waitForLoadState('load')
  const top = await page.locator('h2#soup').evaluate((el) => el.getBoundingClientRect().top)
  expect(top).toBeGreaterThanOrEqual(0)
  expect(top).toBeLessThan(200)
})
