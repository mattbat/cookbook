import { test, expect } from '@playwright/test'

const ingredient = (page, text) => page.locator('.recipe ul > li', { hasText: text })
const servings = (page) => page.locator('input[name="recipe_scaling"]')

test.beforeEach(async ({ page }) => {
  await page.goto('recipes/gumbo/')
})

test('shows the title, author, tags, photo, ingredients and steps', async ({ page }) => {
  await expect(page.locator('.recipe-heading h1')).toHaveText('Gumbo')
  await expect(page.locator('.recipe-author')).toHaveText('By: Tracy Batchelder')
  await expect(page.locator('.recipe-preamble .blog-tags a')).toHaveText(['soup', 'main', 'chicken', 'sausage'])

  const photo = page.locator('.recipe img').first()
  await expect(photo).toBeVisible()
  expect(await photo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)

  await expect(page.getByRole('heading', { name: 'Gumbo Ingredients' })).toBeVisible()
  // The first numbered list is the steps (Notes is numbered too).
  await expect(page.locator('.recipe > ol').first().locator('> li')).toHaveCount(8)
})

test('starts at the recipe\'s servings', async ({ page }) => {
  await expect(servings(page)).toHaveValue('8')
  await expect(ingredient(page, 'cooked chicken')).toHaveText(/^2 cups cooked chicken/)
})

test('+ and - change servings and scale ingredients', async ({ page }) => {
  await page.getByTitle('Increase number of servings').click()
  await expect(servings(page)).toHaveValue('9')
  await expect(ingredient(page, 'cooked chicken')).toHaveText(/^2¼ cups cooked chicken/)

  await page.getByTitle('Decrease number of servings').click()
  await page.getByTitle('Decrease number of servings').click()
  await expect(servings(page)).toHaveValue('7')
  await expect(ingredient(page, 'teaspoons salt')).toHaveText(/^1¾ teaspoons salt/)
})

test('typing a serving size scales fractions', async ({ page }) => {
  await servings(page).fill('16')
  await servings(page).press('Enter')
  await servings(page).blur()
  await expect(ingredient(page, 'cooked chicken')).toHaveText(/^4 cups cooked chicken/)
  await expect(ingredient(page, 'teaspoon pepper').first()).toHaveText(/^1 teaspoon pepper/)
  await expect(ingredient(page, 'cup oil')).toHaveText(/^1⅓ cup oil/)
})

test('tapping a step highlights it', async ({ page }) => {
  const steps = page.locator('.recipe > ol > li')
  await steps.nth(1).click()
  await expect(steps.nth(1)).toHaveClass(/active-step/)
  await steps.nth(3).click()
  await expect(steps.nth(3)).toHaveClass(/active-step/)
  await expect(steps.nth(1)).not.toHaveClass(/active-step/)
})

test('tag links go to that tag', async ({ page }) => {
  await page.locator('.recipe-preamble .blog-tags a', { hasText: 'soup' }).click()
  await expect(page).toHaveURL(/tags\/#soup$/)
})

// Known bug, to fix in Phase 1: scaling treats digits inside video links as amounts.
test.fail('scaling leaves links in the ingredient lists alone', async ({ page }) => {
  await page.goto('recipes/brisket/')
  const video = page.locator('.recipe ul > li a').first()
  const href = await video.getAttribute('href')
  await page.getByTitle('Increase number of servings').click()
  await expect(video).toHaveAttribute('href', href, { timeout: 2000 })
  await expect(page.locator('.recipe ul > li', { hasText: 'Trim:' })).toHaveText(/^Trim:/, { timeout: 2000 })
})
