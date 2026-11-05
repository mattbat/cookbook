import { test, expect } from '@playwright/test'

// Kitchen tools on a recipe page: check-offs, copy, share, keep the screen on, cook mode, timers.

const ingredient = (page, text) => page.locator('.recipe-ingredients li', { hasText: text })
const pageSteps = (page) => page.locator('ol.steps > li')
const cook = (page) => page.locator('dialog.cook')

// Record what would be copied or shared, instead of using the real clipboard and share sheet.
async function stubSharing (page, { share = true } = {}) {
  await page.addInitScript((withShare) => {
    window.__copied = []
    window.__shared = []
    const clipboard = { writeText: (text) => { window.__copied.push(text); return Promise.resolve() } }
    Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => clipboard, configurable: true })
    if (withShare) {
      Object.defineProperty(Navigator.prototype, 'share', {
        value: (data) => { window.__shared.push(data); return Promise.resolve() },
        configurable: true
      })
    } else {
      delete Navigator.prototype.share
    }
  }, share)
}

// A pretend screen wake lock that counts requests and releases.
async function stubWakeLock (page, { supported = true } = {}) {
  await page.addInitScript((isSupported) => {
    delete Navigator.prototype.wakeLock
    if (!isSupported) return
    window.__wake = { requests: 0, held: 0 }
    const wakeLock = {
      request: () => {
        window.__wake.requests++
        window.__wake.held++
        const sentinel = new EventTarget()
        sentinel.release = () => {
          window.__wake.held--
          sentinel.dispatchEvent(new Event('release'))
          return Promise.resolve()
        }
        return Promise.resolve(sentinel)
      }
    }
    Object.defineProperty(Navigator.prototype, 'wakeLock', { get: () => wakeLock, configurable: true })
  }, supported)
}

test.describe('checking off ingredients', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('recipes/gumbo/')
  })

  test('tap an ingredient to check it off; tap again to uncheck', async ({ page }) => {
    const chicken = ingredient(page, 'cooked chicken')
    await expect(chicken).toHaveAttribute('role', 'checkbox')
    await expect(chicken).toHaveAttribute('aria-checked', 'false')
    await chicken.click()
    await expect(chicken).toHaveAttribute('aria-checked', 'true')
    await expect(chicken).toHaveClass(/checked/)
    await chicken.click()
    await expect(chicken).toHaveAttribute('aria-checked', 'false')
  })

  test('works from the keyboard', async ({ page }) => {
    await ingredient(page, 'cup oil').focus()
    await page.keyboard.press('Space')
    await expect(ingredient(page, 'cup oil')).toHaveAttribute('aria-checked', 'true')
  })

  test('checks are remembered when you come back, and Uncheck all clears them', async ({ page }) => {
    await ingredient(page, 'cooked chicken').click()
    await ingredient(page, 'cup oil').click()
    await page.reload()
    await expect(ingredient(page, 'cooked chicken')).toHaveAttribute('aria-checked', 'true')
    await expect(ingredient(page, 'cup oil')).toHaveAttribute('aria-checked', 'true')
    await expect(ingredient(page, 'tsp salt').first()).toHaveAttribute('aria-checked', 'false')

    const clear = page.getByRole('button', { name: 'Uncheck all' })
    await clear.click()
    await expect(page.locator('.recipe-ingredients li.checked')).toHaveCount(0)
    await expect(clear).toBeHidden()
    await page.reload()
    await expect(page.locator('.recipe-ingredients li.checked')).toHaveCount(0)
  })

  test('each recipe keeps its own checks', async ({ page }) => {
    await ingredient(page, 'cooked chicken').click()
    await page.goto('recipes/brisket/')
    await expect(page.locator('.recipe-ingredients li.checked')).toHaveCount(0)
  })

  test('changing servings keeps the checks', async ({ page }) => {
    await ingredient(page, 'cooked chicken').click()
    await page.getByRole('button', { name: 'More servings' }).click()
    await expect(ingredient(page, 'cooked chicken')).toHaveText(/^2¼ cups/)
    await expect(ingredient(page, 'cooked chicken')).toHaveAttribute('aria-checked', 'true')
  })
})

test.describe('copy and share', () => {
  test('Copy list copies the ingredients at the current serving size', async ({ page }) => {
    await stubSharing(page)
    await page.goto('recipes/gumbo/')
    await page.getByLabel('Servings', { exact: true }).fill('16')
    await page.getByLabel('Servings', { exact: true }).press('Enter')
    await page.getByRole('button', { name: 'Copy list' }).click()
    await expect(page.locator('.toast')).toHaveText('Ingredients copied')

    const [text] = await page.evaluate(() => window.__copied)
    const lines = text.split('\n')
    expect(lines[0]).toBe('Gumbo')
    expect(lines[1]).toBe('Servings: 16')
    expect(lines).toContain('Gumbo Ingredients')
    expect(lines).toContain('Roux')
    expect(text).toContain('- 4 cups cooked chicken')
    expect(lines.at(-1)).toMatch(/\/cookbook\/recipes\/gumbo\/$/)
  })

  test('Share opens the phone\'s share sheet with the recipe\'s real address', async ({ page }) => {
    await stubSharing(page)
    await page.goto('recipes/gumbo/')
    await page.getByRole('button', { name: 'Share' }).click()
    const [shared] = await page.evaluate(() => window.__shared)
    expect(shared.title).toBe('Gumbo')
    expect(shared.url).toBe('https://mattbat.com/cookbook/recipes/gumbo/')
  })

  test('without a share sheet, Share copies the link instead', async ({ page }) => {
    await stubSharing(page, { share: false })
    await page.goto('recipes/gumbo/')
    await page.getByRole('button', { name: 'Share' }).click()
    await expect(page.locator('.toast')).toHaveText('Link copied')
    expect(await page.evaluate(() => window.__copied)).toEqual(['https://mattbat.com/cookbook/recipes/gumbo/'])
  })
})

test.describe('keeping the screen on', () => {
  test('the button keeps the screen on, and pressing it again lets it turn off', async ({ page }) => {
    await stubWakeLock(page)
    await page.goto('recipes/gumbo/')
    const button = page.getByRole('button', { name: 'Keep screen on' })
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => page.evaluate(() => window.__wake.held)).toBe(1)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => page.evaluate(() => window.__wake.held)).toBe(0)
  })

  test('is hidden on browsers that can\'t do it', async ({ page }) => {
    await stubWakeLock(page, { supported: false })
    await page.goto('recipes/gumbo/')
    await expect(page.locator('.keep-awake')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Share' })).toBeVisible()
  })
})

test.describe('cook mode', () => {
  test.beforeEach(async ({ page }) => {
    await stubWakeLock(page)
    await page.goto('recipes/gumbo/')
  })

  test('shows one step at a time, with Back and Next', async ({ page }) => {
    await page.getByRole('button', { name: 'Cook mode' }).click()
    await expect(cook(page)).toBeVisible()
    await expect(cook(page).locator('.cook-count')).toHaveText('Step 1 of 8')
    await expect(cook(page).locator('.cook-step')).toContainText('Cut the chicken into pieces')
    await expect(cook(page).getByRole('button', { name: 'Back' })).toBeDisabled()

    await cook(page).getByRole('button', { name: 'Next' }).click()
    await expect(cook(page).locator('.cook-count')).toHaveText('Step 2 of 8')
    await expect(cook(page).locator('.cook-step')).toContainText('Roux. Mix oil and flour')
    await cook(page).getByRole('button', { name: 'Back' }).click()
    await expect(cook(page).locator('.cook-count')).toHaveText('Step 1 of 8')
  })

  test('arrow keys move between steps; Escape closes', async ({ page }) => {
    await page.getByRole('button', { name: 'Cook mode' }).click()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(cook(page).locator('.cook-count')).toHaveText('Step 3 of 8')
    await page.keyboard.press('ArrowLeft')
    await expect(cook(page).locator('.cook-count')).toHaveText('Step 2 of 8')
    await page.keyboard.press('Escape')
    await expect(cook(page)).toBeHidden()
  })

  test('the last step says Done, which closes cook mode on that step', async ({ page }) => {
    await page.getByRole('button', { name: 'Cook mode' }).click()
    for (let i = 0; i < 7; i++) await cook(page).locator('.cook-next').click()
    await expect(cook(page).locator('.cook-count')).toHaveText('Step 8 of 8')
    await cook(page).getByRole('button', { name: 'Done' }).click()
    await expect(cook(page)).toBeHidden()
    await expect(pageSteps(page).nth(7)).toHaveClass(/active-step/)
  })

  test('starts at the step you had highlighted', async ({ page }) => {
    await pageSteps(page).nth(3).click({ position: { x: 24, y: 24 } })
    await page.getByRole('button', { name: 'Cook mode' }).click()
    await expect(cook(page).locator('.cook-count')).toHaveText('Step 4 of 8')
  })

  test('keeps the screen on while cooking, and stops when you close it', async ({ page }) => {
    await page.getByRole('button', { name: 'Cook mode' }).click()
    await expect.poll(() => page.evaluate(() => window.__wake.held)).toBe(1)
    await cook(page).getByRole('button', { name: 'Close cook mode' }).click()
    await expect.poll(() => page.evaluate(() => window.__wake.held)).toBe(0)
  })

  test('ingredients can be checked off from cook mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Cook mode' }).click()
    await cook(page).getByText('Ingredients', { exact: true }).click()
    const oil = cook(page).locator('.cook-ingredients li', { hasText: 'cup oil' })
    await oil.click()
    await expect(cook(page).locator('.cook-ingredients li', { hasText: 'cup oil' })).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Escape')
    await expect(ingredient(page, 'cup oil')).toHaveAttribute('aria-checked', 'true')
  })

  test('recipes with several step lists say which part you\'re on', async ({ page }) => {
    await page.goto('recipes/new-york-cheesecake/')
    await page.getByRole('button', { name: 'Cook mode' }).click()
    await expect(cook(page).locator('.cook-section')).toHaveText('Cheesecake · step 1')
    for (let i = 0; i < 6; i++) await cook(page).locator('.cook-next').click()
    await expect(cook(page).locator('.cook-section')).toHaveText('Strawberry Topping · step 1')
    await expect(cook(page).locator('.cook-count')).toHaveText('Step 7 of 8')
  })
})

test.describe('timers', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install()
    await page.goto('recipes/gumbo/')
  })

  const tray = (page) => page.locator('.timers')
  const startSixMinutes = (page) => page.locator('ol.steps .timer-link', { hasText: '6 minutes' }).click()

  test('times in the steps are buttons; a range uses the shorter time', async ({ page }) => {
    const range = page.locator('ol.steps .timer-link', { hasText: '30-40 minutes' })
    await expect(range).toHaveAttribute('data-seconds', '1800')
    await expect(page.locator('ol.steps .timer-link', { hasText: '6 minutes' })).toHaveAttribute('data-seconds', '360')
    // Not in the ingredients, and not in the Notes
    await expect(page.locator('.recipe-ingredients .timer-link')).toHaveCount(0)
    await expect(tray(page)).toBeHidden()
  })

  test('tapping a time starts a countdown that beeps when done', async ({ page }) => {
    await startSixMinutes(page)
    const timer = tray(page).locator('.timer')
    await expect(timer).toHaveCount(1)
    await expect(timer.locator('.timer-name')).toHaveText('Gumbo · Step 2')
    await expect(timer.locator('.timer-time')).toHaveText(/^(6:00|5:5\d)$/)
    // Starting a timer doesn't also highlight the step
    await expect(page.locator('.active-step')).toHaveCount(0)

    await page.clock.fastForward('02:00')
    await expect(timer.locator('.timer-time')).toHaveText(/^(4:00|3:5\d)$/)
    await page.clock.fastForward('04:05')
    await expect(timer.locator('.timer-time')).toHaveText('Done!')
    await expect(timer).toHaveClass(/done/)

    await timer.getByRole('button', { name: /Dismiss/ }).click()
    await expect(tray(page)).toBeHidden()
  })

  test('a timer can be paused and resumed', async ({ page }) => {
    await startSixMinutes(page)
    const timer = tray(page).locator('.timer')
    await timer.getByRole('button', { name: /^Pause/ }).click()
    const paused = await timer.locator('.timer-time').textContent()
    await page.clock.fastForward('03:00')
    await expect(timer.locator('.timer-time')).toHaveText(paused)
    await timer.getByRole('button', { name: /^Resume/ }).click()
    await page.clock.fastForward('01:00')
    await expect(timer.locator('.timer-time')).not.toHaveText(paused)
  })

  test('tapping the same time twice doesn\'t start a second timer', async ({ page }) => {
    await startSixMinutes(page)
    await startSixMinutes(page)
    await expect(tray(page).locator('.timer')).toHaveCount(1)
    await expect(page.locator('.toast')).toHaveText('That timer is already running')
  })

  test('timers keep running on other pages and after a reload', async ({ page }) => {
    await startSixMinutes(page)
    await page.goto('./')
    await expect(tray(page).locator('.timer-name')).toHaveText('Gumbo · Step 2')
    await page.clock.fastForward('01:00')
    await page.reload()
    await expect(tray(page).locator('.timer-time')).toHaveText(/^(5:00|4:5\d)$/)
    await tray(page).getByRole('button', { name: /^Stop/ }).click()
    await page.reload()
    await expect(tray(page)).toBeHidden()
  })

  test('timers show on top of cook mode, and start from it', async ({ page }) => {
    await page.getByRole('button', { name: 'Cook mode' }).click()
    await cook(page).locator('.cook-next').click()
    await cook(page).locator('.timer-link', { hasText: '6 minutes' }).click()
    const timer = cook(page).locator('.timers .timer')
    await expect(timer).toBeVisible()
    // Not hidden behind the Next button
    const timerBox = await timer.boundingBox()
    const nextBox = await cook(page).locator('.cook-next').boundingBox()
    expect(timerBox.y + timerBox.height).toBeLessThanOrEqual(nextBox.y)
    await page.keyboard.press('Escape')
    await expect(page.locator('body > .timers .timer')).toBeVisible()
  })
})

test('printing leaves out the buttons', async ({ page }) => {
  await page.goto('recipes/gumbo/')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.kitchen-tools')).toBeHidden()
  await expect(page.locator('.ingredient-actions')).toBeHidden()
})

test('Keep screen on goes back to its normal color when turned off', async ({ page, isMobile }) => {
  await stubWakeLock(page)
  await page.goto('recipes/gumbo/')
  const button = page.getByRole('button', { name: 'Keep screen on' })
  const background = () => button.evaluate((el) => getComputedStyle(el).backgroundColor)
  // Move the mouse away first on desktop; a pointer resting on a button rightly highlights it
  const away = async () => { if (!isMobile) await page.mouse.move(0, 0) }
  await away()
  const off = await background()
  await button.click()
  await away()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  expect(await background()).not.toBe(off)
  await button.click()
  await away()
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  // On phones a tapped button used to stay highlighted until you tapped somewhere else
  await expect.poll(background).toBe(off)
})

test.describe('timer sound', () => {
  test.beforeEach(async ({ page }) => {
    // Record what the page plays instead of making noise
    await page.addInitScript(() => {
      window.__plays = []
      HTMLMediaElement.prototype.play = function () {
        window.__plays.push({ src: this.src, muted: this.muted })
        return Promise.resolve()
      }
    })
    await page.clock.install()
    await page.goto('recipes/gumbo/')
  })

  const plays = (page) => page.evaluate(() => window.__plays)

  test('starting a timer unlocks the alarm and plays a short blip', async ({ page }) => {
    await page.locator('ol.steps .timer-link', { hasText: '6 minutes' }).click()
    const [unlock, ...rest] = await plays(page)
    // Phones only allow sound that a tap started: the alarm is played silently once, now
    expect(unlock.muted).toBe(true)
    expect(unlock.src).toMatch(/^blob:/)
    expect(rest.some((play) => !play.muted && play.src !== unlock.src)).toBe(true)
  })

  test('the alarm sounds when the timer is done, and repeats until dismissed', async ({ page }) => {
    await page.locator('ol.steps .timer-link', { hasText: '6 minutes' }).click()
    const alarm = (await plays(page))[0].src
    const alarmPlays = async () => (await plays(page)).filter((play) => play.src === alarm && !play.muted).length
    expect(await alarmPlays()).toBe(0)

    await page.clock.fastForward('06:01')
    await expect(page.locator('.timer.done')).toBeVisible()
    // (Exact counts depend on how busy the computer is, so check it starts, repeats, then stops)
    await expect.poll(alarmPlays).toBeGreaterThanOrEqual(1)
    const first = await alarmPlays()
    await page.clock.fastForward('00:05')
    await expect.poll(alarmPlays).toBeGreaterThan(first)

    await page.locator('.timer').getByRole('button', { name: /Dismiss/ }).click()
    const beforeDismiss = await alarmPlays()
    await page.clock.fastForward('00:10')
    expect(await alarmPlays()).toBe(beforeDismiss)
  })

  test('after a reload, the first tap anywhere unlocks the sound again', async ({ page }) => {
    await page.locator('ol.steps .timer-link', { hasText: '6 minutes' }).click()
    await page.reload()
    expect(await plays(page)).toEqual([])
    await page.locator('h1').click()
    const [unlock] = await plays(page)
    expect(unlock.muted).toBe(true)
  })
})
