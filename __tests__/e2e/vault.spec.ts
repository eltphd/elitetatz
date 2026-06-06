import { test, expect } from '@playwright/test'

test.describe('The Vault', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vault')
  })

  test('shows The Vault heading', async ({ page }) => {
    await expect(page.getByText('The Vault')).toBeVisible()
  })

  test('renders asset cards', async ({ page }) => {
    const assets = page.locator('[data-testid^="vault-asset-"]')
    await expect(assets).toHaveCountGreaterThan(0)
  })

  test('filter tabs are visible', async ({ page }) => {
    await expect(page.getByText(/All \(\d+\)/)).toBeVisible()
    await expect(page.getByText('Reference')).toBeVisible()
    await expect(page.getByText('Final')).toBeVisible()
  })

  test('type filter narrows results', async ({ page }) => {
    const allAssets = page.locator('[data-testid^="vault-asset-"]')
    const initialCount = await allAssets.count()

    await page.getByText('Final').click()
    const filteredCount = await allAssets.count()
    expect(filteredCount).toBeLessThanOrEqual(initialCount)
  })

  test('clicking an asset opens full-screen preview', async ({ page }) => {
    const firstAsset = page.locator('[data-testid^="vault-asset-"]').first()
    await firstAsset.click()
    await expect(page.getByTestId('vault-preview')).toBeVisible()
  })

  test('preview close button works', async ({ page }) => {
    const firstAsset = page.locator('[data-testid^="vault-asset-"]').first()
    await firstAsset.click()
    await expect(page.getByTestId('vault-preview')).toBeVisible()

    await page.locator('[data-testid="vault-preview"] button').last().click()
    await expect(page.getByTestId('vault-preview')).not.toBeVisible()
  })
})
