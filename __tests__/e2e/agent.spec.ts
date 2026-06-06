import { test, expect } from '@playwright/test'

test.describe('TatzAI Agent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agent')
  })

  test('shows welcome message', async ({ page }) => {
    await expect(page.getByText("Hey! I'm TatzAI")).toBeVisible()
  })

  test('shows starter prompt suggestions', async ({ page }) => {
    await expect(page.getByText('Small minimalist piece, first tattoo')).toBeVisible()
  })

  test('has functional text input', async ({ page }) => {
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()
    await textarea.fill('I want a small rose on my wrist')
    await expect(textarea).toHaveValue('I want a small rose on my wrist')
  })

  test('send button is disabled when input is empty', async ({ page }) => {
    // Send button should be visually disabled (opacity-30)
    const sendBtn = page.locator('button[disabled]').first()
    await expect(sendBtn).toBeVisible()
  })

  test('send button enables when text is entered', async ({ page }) => {
    const textarea = page.locator('textarea')
    await textarea.fill('I want a small rose')
    // Button should no longer have disabled attribute
    const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last()
    await expect(sendBtn).not.toBeDisabled()
  })

  test('starter prompt sends a message when clicked', async ({ page }) => {
    // Note: this test requires ANTHROPIC_API_KEY to be set for a response
    // Without it, we just verify the message appears in the chat
    const prompt = page.getByText('Small minimalist piece, first tattoo')
    await prompt.click()

    // User message should appear
    await expect(page.getByText('Small minimalist piece, first tattoo').last()).toBeVisible()
  })

  test('displays TatzAI avatar in header', async ({ page }) => {
    await expect(page.getByText('Your tattoo concierge')).toBeVisible()
  })

  test('image attach button is visible', async ({ page }) => {
    // ImagePlus icon button should be present
    const attachBtn = page.locator('button').first()
    await expect(attachBtn).toBeVisible()
  })
})
