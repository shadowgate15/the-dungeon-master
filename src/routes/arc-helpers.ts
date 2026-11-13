import { expect, type Page } from '@playwright/test'

/** The Arc section starts collapsed on the Campaign page; open it if it is not already. */
export async function expandArc(page: Page) {
  const toggle = page.getByRole('button', { name: 'Arc', exact: true })
  await expect(toggle).toBeVisible()
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}
