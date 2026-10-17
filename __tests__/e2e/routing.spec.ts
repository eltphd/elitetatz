import { test, expect } from '@playwright/test'

// The pilot is one funnel: Lacey's page → concierge → signed client links.
// Retired marketplace URLs still circulate and must land somewhere real.

test.describe('Routing', () => {
  for (const path of ['/', '/explore', '/flash', '/vault', '/saved', '/matches', '/profile', '/artist/1']) {
    test(`${path} redirects to /rawsunart`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/rawsunart$/)
    })
  }

  test('/artist/signup redirects to the artist waitlist', async ({ page }) => {
    await page.goto('/artist/signup')
    await expect(page).toHaveURL(/\/artists$/)
  })

  test('/dashboard requires a login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login\?next=\/dashboard$/)
  })

  test('Lacey’s page links to the concierge', async ({ page }) => {
    await page.goto('/rawsunart')
    await expect(page.getByRole('heading', { level: 1, name: 'Lacey Rawson' })).toBeVisible()
    await expect(page.locator('a[href="/agent?mode=rawsunart"]').first()).toBeVisible()
  })
})
