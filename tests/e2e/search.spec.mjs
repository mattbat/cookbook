import { test, expect } from '@playwright/test'

const box = (page) => page.getByRole('searchbox', { name: 'Search recipes' })
const titles = (page) => page.locator('[data-results] .card:visible .card-title')

async function search (page, text) {
  await box(page).fill(text)
  return titles(page)
}

test.beforeEach(async ({ page }) => {
  await page.goto('search/')
  // Wait until the search index has loaded
  await expect(page.locator('[data-search][data-ready]')).toBeAttached()
})

test('lists every recipe before you type', async ({ page }) => {
  await expect(page.locator('.search-status')).toHaveText('53 recipes')
})

test('finds a recipe by name and opens it', async ({ page }) => {
  const results = await search(page, 'gumbo')
  await expect(results.first()).toHaveText('Gumbo')
  await results.first().click()
  await expect(page).toHaveURL(/recipes\/gumbo\/$/)
})

test('puts title matches first', async ({ page }) => {
  const results = await search(page, 'brisket')
  await expect(results.nth(0)).toHaveText(/Brisket/)
  await expect(results.nth(1)).toHaveText(/Brisket/)
})

test('finds a recipe by an ingredient or a word in its steps', async ({ page }) => {
  await expect((await search(page, 'roux')).filter({ hasText: 'Gumbo' })).toHaveCount(1)
  await expect((await search(page, 'graham crackers')).filter({ hasText: 'New York Cheesecake' })).toHaveCount(1)
})

test('forgives a small typo', async ({ page }) => {
  await expect((await search(page, 'gumbp')).first()).toHaveText('Gumbo')
  await expect((await search(page, 'chesecake')).first()).toHaveText('New York Cheesecake')
})

test('matches the start of a word', async ({ page }) => {
  await expect((await search(page, 'enchil')).filter({ hasText: 'Chili con Carne Enchiladas' })).toHaveCount(1)
})

test('every word has to match', async ({ page }) => {
  const results = await search(page, 'pork chops')
  await expect(results.first()).toHaveText('Pork Chops')
  await expect(results.filter({ hasText: 'Pulled Pork' })).toHaveCount(0)
})

test('finds recipes by tag and by author, ignoring case', async ({ page }) => {
  await expect((await search(page, 'DESSERT')).filter({ hasText: 'Black Forest Cake' })).toHaveCount(1)
  await expect((await search(page, 'tracy')).filter({ hasText: 'Gumbo' })).toHaveCount(1)
})

test('says so when nothing matches', async ({ page }) => {
  await search(page, 'zzzzqqq')
  await expect(titles(page)).toHaveCount(0)
  await expect(page.getByText('No recipes match')).toBeVisible()
  await expect(page.locator('.search-status')).toHaveText('0 recipes')
})

test('category chips narrow the results, and combine with words', async ({ page }) => {
  const chips = page.getByRole('navigation', { name: 'Categories' })
  await chips.getByRole('link', { name: 'Desserts' }).click()
  await expect(chips.getByRole('link', { name: 'Desserts' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/\?tag=dessert$/)
  await expect(titles(page).filter({ hasText: 'Gumbo' })).toHaveCount(0)

  await box(page).fill('cake')
  await expect(titles(page).filter({ hasText: 'Black Forest Cake' })).toHaveCount(1)
  await expect(page).toHaveURL(/\?q=cake&tag=dessert$/)

  await chips.getByRole('link', { name: 'All' }).click()
  await expect(page).toHaveURL(/\?q=cake$/)
})

test('a shared search link opens with its results', async ({ page }) => {
  await page.goto('search/?q=roux&tag=soup')
  await expect(page.locator('[data-search][data-ready]')).toBeAttached()
  await expect(box(page)).toHaveValue('roux')
  await expect(titles(page).filter({ hasText: 'Gumbo' })).toHaveCount(1)
  await expect(page.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: 'Soups' })).toHaveAttribute('aria-pressed', 'true')
})
