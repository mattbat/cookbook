import { test, expect } from '@playwright/test'

async function search (page, text) {
  const input = page.locator('#home-search-input')
  await input.fill('')
  await input.pressSequentially(text)
  return page.locator('#home-search-results-container .post-title')
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
})

test('finds a recipe by name and opens it', async ({ page }) => {
  const results = await search(page, 'gumbo')
  await expect(results).toHaveText(['Gumbo'])
  await results.first().click()
  await expect(page).toHaveURL(/recipes\/gumbo\/$/)
})

test('finds recipes by tag', async ({ page }) => {
  const results = await search(page, 'dessert')
  await expect(results.filter({ hasText: 'Black Forest Cake' })).toHaveCount(1)
})

test('finds recipes by author', async ({ page }) => {
  const results = await search(page, 'Tracy')
  await expect(results.filter({ hasText: 'Gumbo' })).toHaveCount(1)
})

test('matching is not case sensitive', async ({ page }) => {
  await expect(await search(page, 'BRISKET')).toHaveCount(2)
})

test('shows nothing for a search with no matches', async ({ page }) => {
  const results = await search(page, 'zzzzqqq')
  await page.waitForTimeout(300)
  await expect(results).toHaveCount(0)
})

test('search box in the menu works on other pages', async ({ page, isMobile }) => {
  await page.goto('recipes/gumbo/')
  if (isMobile) await page.getByRole('button', { name: 'Toggle navigation' }).click()
  await page.locator('#search-input').pressSequentially('brisket')
  const results = page.locator('#search-results-container a')
  await expect(results.filter({ hasText: 'Pork Belly Brisket' })).toHaveCount(1)
  await results.filter({ hasText: /^Brisket$/ }).click()
  await expect(page).toHaveURL(/recipes\/brisket\/$/)
})

// Known gaps, to fix in Phase 2 (remove `.fail` once fixed).
test.fail('finds a recipe by an ingredient', async ({ page }) => {
  const results = await search(page, 'roux')
  await expect(results.filter({ hasText: 'Gumbo' })).toHaveCount(1, { timeout: 2000 })
})

test.fail('tolerates a small typo', async ({ page }) => {
  const results = await search(page, 'gumbp')
  await expect(results.filter({ hasText: 'Gumbo' })).toHaveCount(1, { timeout: 2000 })
})
