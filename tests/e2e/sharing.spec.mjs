import { test, expect } from '@playwright/test'

const meta = (page, property) => page.locator(`meta[property="${property}"]`).getAttribute('content')

test.beforeEach(async ({ page }) => {
  await page.goto('recipes/gumbo/')
})

test('shared links get the recipe name and the real address', async ({ page }) => {
  await expect(page).toHaveTitle('Gumbo')
  expect(await meta(page, 'og:title')).toBe('Gumbo')
  expect(await meta(page, 'og:url')).toBe('https://mattbat.com/cookbook/recipes/gumbo/')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://mattbat.com/cookbook/recipes/gumbo/')
})

// Known bugs, to fix in Phase 1.
test.fail('shared links show the recipe photo', async ({ page }) => {
  expect(await meta(page, 'og:image')).toBe('https://mattbat.com/cookbook/img/gumbo.jpeg')
})

test.fail('shared link description starts with the recipe, not the page header', async ({ page }) => {
  expect(await meta(page, 'og:description')).not.toMatch(/^Cookbook|Toggle navigation|By:/)
})
