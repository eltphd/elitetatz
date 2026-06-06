import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('displays TatzAI branding', async ({ page }) => {
    await expect(page.locator('text=TatzAI').first()).toBeVisible()
  })

  test('shows Start with TatzAI CTA', async ({ page }) => {
    await expect(page.getByText('Start with TatzAI')).toBeVisible()
  })

  test('shows Elite Artists section', async ({ page }) => {
    await expect(page.getByText('Elite Artists')).toBeVisible()
  })

  test('renders artist cards', async ({ page }) => {
    // At least 2 artist cards should be visible
    const cards = page.locator('a[href^="/artist/"]')
    await expect(cards).toHaveCountGreaterThan(1)
  })

  test('location filter chips are visible', async ({ page }) => {
    await expect(page.getByText('NYC')).toBeVisible()
    await expect(page.getByText('LA')).toBeVisible()
    await expect(page.getByText('Miami')).toBeVisible()
  })

  test('bottom nav is present', async ({ page }) => {
    await expect(page.getByTestId('bottom-nav')).toBeVisible()
    await expect(page.getByTestId('nav-home')).toBeVisible()
    await expect(page.getByTestId('nav-agent')).toBeVisible()
  })

  test('navigates to agent page from CTA', async ({ page }) => {
    await page.getByText('Start with TatzAI').click()
    await expect(page).toHaveURL('/agent')
  })

  test('navigates to explore page', async ({ page }) => {
    await page.getByTestId('nav-explore').click()
    await expect(page).toHaveURL('/explore')
  })
})
