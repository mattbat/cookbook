import { test, expect } from '@playwright/test'

// The US / Metric switch on recipe pages.

const ingredient = (page, text) => page.locator('.recipe-ingredients li', { hasText: text })
const firstStep = (page) => page.locator('ol.steps > li').first()
const metric = (page) => page.getByRole('button', { name: 'Metric', exact: true })
const us = (page) => page.getByRole('button', { name: 'US', exact: true })

test.beforeEach(async ({ page }) => {
  await page.goto('recipes/new-york-cheesecake/')
})

test('starts in US units', async ({ page }) => {
  await expect(us(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(ingredient(page, 'cream cheese')).toHaveText(/^2½ lb cream cheese/)
  await expect(firstStep(page)).toContainText('325°F')
})

test('Metric converts the ingredients and the steps, and US switches back', async ({ page }) => {
  const usCheese = await ingredient(page, 'cream cheese').textContent()
  await metric(page).click()
  await expect(metric(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(ingredient(page, 'cream cheese')).toHaveText(/^1\.15 kg cream cheese/)
  await expect(ingredient(page, 'sour cream')).toHaveText(/^80 mL sour cream/)
  await expect(ingredient(page, 'table salt').first()).toHaveText(/tsp table salt/)
  await expect(firstStep(page)).toContainText('165°C')
  await expect(firstStep(page)).toContainText('23 cm springform pan')
  await expect(firstStep(page)).not.toContainText('°F')

  await us(page).click()
  await expect(ingredient(page, 'cream cheese')).toHaveText(usCheese)
  await expect(firstStep(page)).toContainText('325°F')
  await expect(firstStep(page)).toContainText('9-inch springform pan')
})

test('metric amounts follow the servings', async ({ page }) => {
  await page.goto('recipes/gumbo/')
  await metric(page).click()
  await expect(ingredient(page, 'cooked chicken')).toHaveText(/^470 mL cooked chicken/)
  await page.getByLabel('Servings', { exact: true }).fill('16')
  await page.getByLabel('Servings', { exact: true }).press('Enter')
  await expect(ingredient(page, 'cooked chicken')).toHaveText(/^950 mL cooked chicken/)
  await expect(ingredient(page, 'sausage, cut')).toHaveText(/^910 g sausage/)
})

test('the choice is remembered on this device', async ({ page }) => {
  await metric(page).click()
  await page.goto('recipes/gumbo/')
  await expect(metric(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(ingredient(page, 'cooked chicken')).toHaveText(/^470 mL/)
  await us(page).click()
  await page.reload()
  await expect(us(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(ingredient(page, 'cooked chicken')).toHaveText(/^2 cups/)
})

test('checked-off ingredients stay checked when switching', async ({ page }) => {
  await ingredient(page, 'sour cream').click()
  await metric(page).click()
  await expect(ingredient(page, 'sour cream')).toHaveAttribute('aria-checked', 'true')
})

test('timers in the steps still work in metric', async ({ page }) => {
  await metric(page).click()
  const timer = firstStep(page).locator('.timer-link').first()
  await expect(timer).toHaveText('30 seconds')
  await timer.click()
  await expect(page.locator('.timers .timer')).toHaveCount(1)
})

test('cook mode and Copy list use the units you chose', async ({ page }) => {
  await page.addInitScript(() => {
    window.__copied = []
    const clipboard = { writeText: (text) => { window.__copied.push(text); return Promise.resolve() } }
    Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => clipboard, configurable: true })
  })
  await page.reload()
  await metric(page).click()
  await page.getByRole('button', { name: 'Copy list' }).click()
  const [text] = await page.evaluate(() => window.__copied)
  expect(text).toContain('- 1.15 kg cream cheese')

  await page.getByRole('button', { name: 'Cook mode' }).click()
  await expect(page.locator('dialog.cook .cook-step')).toContainText('165°C')
})
