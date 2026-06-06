import { test, expect } from '@playwright/test'

test.describe('Explore page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/explore')
  })

  test('shows search input', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible()
  })

  test('renders artist cards', async ({ page }) => {
    const cards = page.locator('a[href^="/artist/"]')
    await expect(cards).toHaveCountGreaterThan(1)
  })

  test('search filters artist list', async ({ page }) => {
    const allCards = page.locator('a[href^="/artist/"]')
    const initialCount = await allCards.count()

    await page.locator('input[placeholder*="Search"]').fill('Marco')
    const filteredCount = await allCards.count()
    expect(filteredCount).toBeLessThanOrEqual(initialCount)
    await expect(page.getByText('Marco Vega')).toBeVisible()
  })

  test('city filter reduces results', async ({ page }) => {
    const allCards = page.locator('a[href^="/artist/"]')
    const initialCount = await allCards.count()

    await page.getByText('NYC').click()
    const filteredCount = await allCards.count()
    expect(filteredCount).toBeLessThanOrEqual(initialCount)
  })

  test('clear search button appears and works', async ({ page }) => {
    await page.locator('input[placeholder*="Search"]').fill('xyz')
    // X button should appear
    const clearBtn = page.locator('button').filter({ has: page.locator('[data-lucide="x"]') })
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()
    await expect(page.locator('input[placeholder*="Search"]')).toHaveValue('')
  })

  test('clicking artist card navigates to profile', async ({ page }) => {
    const firstCard = page.locator('a[href^="/artist/"]').first()
    const href = await firstCard.getAttribute('href')
    await firstCard.click()
    await expect(page).toHaveURL(href!)
  })
})
