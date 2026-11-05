import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const live = JSON.parse(fs.readFileSync(new URL('../fixtures/live-site.json', import.meta.url), 'utf8'))

test('home page shows featured and recent recipes that open', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1, name: 'Batchelder Recipes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Featured' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recently added' })).toBeVisible()

  const card = page.locator('.card').first()
  const title = (await card.locator('.card-title').textContent()).trim()
  await card.click()
  await expect(page.locator('h1')).toHaveText(title)
})

test('home search box opens search results', async ({ page }) => {
  await page.goto('./')
  const box = page.getByRole('searchbox', { name: 'Search recipes' })
  await box.fill('gumbo')
  await box.press('Enter')
  await expect(page).toHaveURL(/search\/\?q=gumbo$/)
  await expect(page.locator('[data-results] .card:visible .card-title').first()).toHaveText('Gumbo')
})

test('a category chip on the home page shows that category', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: 'Soups' }).click()
  await expect(page).toHaveURL(/search\/\?tag=soup$/)
  const shown = page.locator('[data-results] .card:visible')
  await expect(shown.first()).toBeVisible()
  for (const tags of await shown.evaluateAll((cards) => cards.map((card) => card.dataset.tags))) {
    expect(tags.split(' ')).toContain('soup')
  }
})

test('A–Z page lists every recipe', async ({ page }) => {
  await page.goto('list/')
  await expect(page.locator('.index li')).toHaveCount(live.recipes.length)
  await page.getByRole('link', { name: /^Gumbo/ }).click()
  await expect(page).toHaveURL(/recipes\/gumbo\/$/)
})

test('Browse page has a section per tag, and its chips jump to them', async ({ page }) => {
  await page.goto('tags/')
  await expect(page.locator('h2#soup')).toBeVisible()
  await expect(page.locator('h2#dessert')).toBeVisible()
  await page.getByRole('navigation', { name: 'Jump to a tag' }).getByRole('link', { name: 'dessert', exact: true }).click()
  await expect(page).toHaveURL(/tags\/#dessert$/)
})

test('phones get tabs along the bottom; desktops get links in the top bar', async ({ page, isMobile }) => {
  await page.goto('./')
  const tabbar = page.locator('.tabbar')
  const topnav = page.locator('.topnav')
  if (isMobile) {
    await expect(tabbar).toBeVisible()
    await expect(topnav).toBeHidden()
  } else {
    await expect(topnav).toBeVisible()
    await expect(tabbar).toBeHidden()
  }

  const nav = isMobile ? tabbar : topnav
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'Browse' }).click()
  await expect(page).toHaveURL(/tags\/$/)
  await expect(nav.getByRole('link', { name: 'Browse' })).toHaveAttribute('aria-current', 'page')
})

test('unknown address shows the 404 page', async ({ page }) => {
  const response = await page.goto('recipes/not-a-real-recipe/')
  expect(response.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Error 404' })).toBeVisible()
})
