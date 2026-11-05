import { test, expect } from '@playwright/test'

const ingredient = (page, text) => page.locator('.recipe-ingredients li', { hasText: text })
const servings = (page) => page.getByLabel('Servings', { exact: true })
const steps = (page) => page.locator('.recipe-method ol').first().locator('> li')

test.beforeEach(async ({ page }) => {
  await page.goto('recipes/gumbo/')
})

test('shows the photo, title, author, times, tags, ingredients and steps', async ({ page }) => {
  await expect(page.locator('h1')).toHaveText('Gumbo')
  await expect(page.locator('.recipe-author')).toHaveText('By Tracy Batchelder')
  await expect(page.locator('.facts')).toContainText('Prep 1 hr 30 min')
  await expect(page.locator('.facts')).toContainText('Cook 30 min')
  await expect(page.locator('.facts')).toContainText('Total 2 hr')
  await expect(page.locator('.recipe-tags a')).toHaveText(['soup', 'main', 'chicken', 'poultry', 'sausage'])

  const photo = page.locator('.recipe-photo img')
  await expect(photo).toBeVisible()
  expect(await photo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)

  await expect(page.getByRole('heading', { name: 'Gumbo Ingredients' })).toBeVisible()
  await expect(steps(page)).toHaveCount(8)
})

test('the photo is shown once, at the top', async ({ page }) => {
  await expect(page.locator('main img')).toHaveCount(1)
})

test('starts at the recipe\'s servings', async ({ page }) => {
  await expect(servings(page)).toHaveValue('8')
  await expect(ingredient(page, 'cooked chicken')).toHaveText(/^2 cups cooked chicken/)
})

test('+ and - change servings and scale ingredients', async ({ page }) => {
  await page.getByRole('button', { name: 'More servings' }).click()
  await expect(servings(page)).toHaveValue('9')
  await expect(ingredient(page, 'cooked chicken')).toHaveText(/^2¼ cups cooked chicken/)

  await page.getByRole('button', { name: 'Fewer servings' }).click()
  await page.getByRole('button', { name: 'Fewer servings' }).click()
  await expect(servings(page)).toHaveValue('7')
  await expect(ingredient(page, 'tsp salt').first()).toHaveText(/^1¾ tsp salt/)
})

test('typing a serving size scales fractions', async ({ page }) => {
  await servings(page).fill('16')
  await servings(page).press('Enter')
  await servings(page).blur()
  await expect(ingredient(page, 'cooked chicken')).toHaveText(/^4 cups cooked chicken/)
  await expect(ingredient(page, 'tsp pepper').first()).toHaveText(/^1 tsp pepper/)
  await expect(ingredient(page, 'cup oil')).toHaveText(/^1⅓ cup oil/)
})

test('tapping a step highlights it; tapping again clears it', async ({ page }) => {
  await steps(page).nth(1).click()
  await expect(steps(page).nth(1)).toHaveClass(/active-step/)
  await steps(page).nth(3).click()
  await expect(steps(page).nth(3)).toHaveClass(/active-step/)
  await expect(steps(page).nth(1)).not.toHaveClass(/active-step/)
  await steps(page).nth(3).click()
  await expect(page.locator('.active-step')).toHaveCount(0)
})

test('tag links go to that tag', async ({ page }) => {
  await page.locator('.recipe-tags a', { hasText: 'soup' }).click()
  await expect(page).toHaveURL(/tags\/#soup$/)
})

test('ingredients sit beside the steps on wide screens, above them on phones', async ({ page, isMobile }) => {
  const ingredients = await page.locator('.recipe-ingredients').boundingBox()
  const method = await page.locator('.recipe-method').boundingBox()
  if (isMobile) {
    expect(method.y).toBeGreaterThan(ingredients.y + ingredients.height - 1)
  } else {
    expect(method.x).toBeGreaterThan(ingredients.x + ingredients.width - 1)
    expect(Math.abs(method.y - ingredients.y)).toBeLessThan(40)
  }
})

test('scaling leaves links in the recipe alone', async ({ page }) => {
  await page.goto('recipes/brisket/')
  const video = page.locator('.recipe a[href*="youtube"]').first()
  const href = await video.getAttribute('href')
  await page.getByRole('button', { name: 'More servings' }).click()
  await expect(video).toHaveAttribute('href', href)
  await expect(page.locator('.recipe li', { hasText: 'Trim:' })).toHaveText(/^Trim:/)
})
