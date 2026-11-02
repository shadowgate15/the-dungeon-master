import type { Page } from '@playwright/test'

/** Opens the Worlds page and its New World dialog, once hydration has finished. */
export async function openNewWorld(page: Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle') // the dialog only becomes a modal after hydration
  await page.getByRole('link', { name: 'New World' }).click()
  await page.getByRole('dialog', { name: 'New World' }).waitFor()
}

/** Creates a World by name through the dialog and waits for it to close. */
export async function createWorld(page: Page, name: string) {
  await openNewWorld(page)
  await page
    .getByRole('dialog', { name: 'New World' })
    .getByLabel('Name', { exact: true })
    .fill(name)
  await page.getByRole('button', { name: 'Create World' }).click()
  await page.getByRole('dialog', { name: 'New World' }).waitFor({ state: 'hidden' })
}
