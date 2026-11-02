import { expect, test, type Page } from '@playwright/test'

const toggle = (page: Page) => page.getByRole('form', { name: 'Theme' })
const option = (page: Page, name: string) => toggle(page).getByRole('button', { name })

test.describe('theme toggle with JavaScript', () => {
  test('applies the theme instantly and remembers it across reloads', async ({ page }) => {
    await page.goto('/')
    await expect(option(page, 'System')).toHaveAttribute('aria-pressed', 'true')

    await option(page, 'Dark').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(option(page, 'Dark')).toHaveAttribute('aria-pressed', 'true')
    await expect(option(page, 'System')).toHaveAttribute('aria-pressed', 'false')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(option(page, 'Dark')).toHaveAttribute('aria-pressed', 'true')

    await option(page, 'Light').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('System clears the override so the app follows the OS', async ({ page }) => {
    await page.goto('/')
    await option(page, 'Light').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    await option(page, 'System').click()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme')
    await page.reload()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme')
    await expect(option(page, 'System')).toHaveAttribute('aria-pressed', 'true')
  })

  test('shows a visible focus ring on keyboard focus', async ({ page }) => {
    await page.goto('/')
    await option(page, 'System').focus()
    await page.keyboard.press('Tab')
    await expect(option(page, 'Light')).toBeFocused()
    const outline = await option(page, 'Light').evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')
  })
})

test.describe('theme toggle without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('sets the cookie, redirects back and renders the theme on the server', async ({ page }) => {
    await page.goto('/?new')
    await option(page, 'Dark').click()
    await expect(page).toHaveURL(/\/\?new$/)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(option(page, 'Dark')).toHaveAttribute('aria-pressed', 'true')

    await option(page, 'System').click()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme')
    await expect(option(page, 'System')).toHaveAttribute('aria-pressed', 'true')
  })
})
