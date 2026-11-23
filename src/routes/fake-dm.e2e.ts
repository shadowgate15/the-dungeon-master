import path from 'node:path'
import { expect, test } from '@playwright/test'
import { startFakeDm } from '../testing/fake-dm'
import { E2E_CAMPAIGNS, E2E_HOME } from '../../playwright.config'

test('a fake DM reaches the game server through the real bridge', async ({ page }) => {
  const name = `Bridge Hold ${Date.now()}`
  await page.goto('/campaigns')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'New Campaign' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Campaign' })
  await dialog.getByLabel('Name', { exact: true }).fill(name)
  const folder = await dialog.getByLabel('Folder').inputValue()
  expect(path.dirname(folder)).toBe(E2E_CAMPAIGNS)
  await dialog.getByRole('button', { name: 'Create Campaign' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()

  const dm = await startFakeDm({ folder, home: E2E_HOME })
  try {
    expect(dm.protocolVersion).toBe('2025-06-18')
    expect((await dm.listTools()).map((t) => t.name)).toContain('seed')
    expect(await dm.call('seed')).toEqual({
      isError: false,
      payload: expect.objectContaining({ handle: 'campaign', name })
    })
    await dm.close()
  } finally {
    await dm.kill()
  }
})
