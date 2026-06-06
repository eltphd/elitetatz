import { test, expect } from '@playwright/test'

test.describe('Flash Drop page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flash')
  })

  test('shows Flash Drop heading', async ({ page }) => {
    await expect(page.getByText('Flash Drop')).toBeVisible()
  })

  test('shows 1-of-1 badge', async ({ page }) => {
    await expect(page.getByText('1-of-1')).toBeVisible()
  })

  test('renders flash design cards', async ({ page }) => {
    // Should have multiple flash cards
    const cards = page.locator('button').filter({ hasText: /\$/ })
    await expect(cards).toHaveCountGreaterThan(2)
  })

  test('style filter chips work', async ({ page }) => {
    await page.getByText('blackwork').first().click()
    // Available count should update
    await expect(page.getByText(/available/)).toBeVisible()
  })

  test('clicking a flash card opens detail sheet', async ({ page }) => {
    // Click first available card
    const firstCard = page.locator('button').filter({ hasText: /\$/ }).first()
    const title = await firstCard.locator('p').first().textContent()
    await firstCard.click()

    // Detail sheet should be visible
    await expect(page.getByText('Secure This Design')).toBeVisible()
  })

  test('sold designs show claimed state in detail sheet', async ({ page }) => {
    // Find a sold card and click it
    const soldCard = page.locator('button').filter({ hasText: 'Claimed' }).first()
    if (await soldCard.count() > 0) {
      await soldCard.click()
      await expect(page.getByText('This design has been claimed')).toBeVisible()
    }
  })

  test('detail sheet close button works', async ({ page }) => {
    const firstCard = page.locator('button').filter({ hasText: /\$/ }).first()
    await firstCard.click()

    // Close it
    await page.locator('button').filter({ has: page.locator('[data-lucide="x"]') }).first().click()

    // Detail sheet should be gone
    await expect(page.getByText('Secure This Design')).not.toBeVisible()
  })

  test('navigates to Flash via bottom nav', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('nav-flash').click()
    await expect(page).toHaveURL('/flash')
  })
})
