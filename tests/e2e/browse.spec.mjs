import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const live = JSON.parse(fs.readFileSync(new URL('../fixtures/live-site.json', import.meta.url), 'utf8'))

test('home page shows featured recipes that open', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Batchelder Recipes' })).toBeVisible()

  const cards = page.locator('.recipes-list:not(#home-search-results-container) .recipe-preview')
  await expect(cards.first()).toBeVisible()

  const title = (await cards.first().locator('.post-title').textContent()).trim()
  await cards.first().locator('.post-title').click()
  await expect(page.locator('.recipe-heading h1')).toHaveText(title)
})

test('list page shows every recipe', async ({ page }) => {
  await page.goto('list/')
  await expect(page.locator('.post-list-preview')).toHaveCount(live.recipes.length)
  await page.getByRole('link', { name: 'Gumbo', exact: true }).click()
  await expect(page).toHaveURL(/recipes\/gumbo\/$/)
})

test('tags page has a section per tag', async ({ page }) => {
  await page.goto('tags/')
  await expect(page.locator('#full-tags-list h2#soup')).toBeVisible()
  await expect(page.locator('#full-tags-list h2#dessert')).toBeVisible()
})

test('Categories menu opens a category', async ({ page, isMobile }) => {
  await page.goto('./')
  if (isMobile) await page.getByRole('button', { name: 'Toggle navigation' }).click()
  await page.locator('.navlinks-parent', { hasText: 'Categories' }).click()
  await page.locator('.navlinks-children').getByRole('link', { name: 'Soups' }).click()
  await expect(page).toHaveURL(/tags\/#soup$/)
})

test('unknown address shows the 404 page', async ({ page }) => {
  const response = await page.goto('recipes/not-a-real-recipe/')
  expect(response.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Error 404' })).toBeVisible()
})
