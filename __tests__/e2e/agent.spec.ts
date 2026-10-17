import { test, expect } from '@playwright/test'

test.describe('Concierge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agent?mode=rawsunart')
  })

  test('opens as Lacey’s booking assistant', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'RawSunArt · Concierge' })).toBeVisible()
    await expect(page.getByText('Booking assistant for Lacey Rawson', { exact: true })).toBeVisible()
  })

  test('a bare /agent link is Lacey’s too', async ({ page }) => {
    await page.goto('/agent')
    await expect(page.getByText('Booking assistant for Lacey Rawson', { exact: true })).toBeVisible()
  })

  test('shows Lacey’s starter prompts', async ({ page }) => {
    await expect(page.getByText('A watercolor piece — I have a rough idea')).toBeVisible()
  })

  test('send is disabled until there is text', async ({ page }) => {
    await expect(page.locator('button[disabled]').first()).toBeVisible()
    const textarea = page.locator('textarea')
    await textarea.fill('A small watercolor hummingbird on my wrist')
    await expect(textarea).toHaveValue('A small watercolor hummingbird on my wrist')
    const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last()
    await expect(sendBtn).not.toBeDisabled()
  })

  test('links back to rawsunart.com', async ({ page }) => {
    await expect(page.getByRole('link', { name: '← Back to rawsunart.com' })).toBeVisible()
  })
})
