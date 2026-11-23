import path from 'node:path'
import { defineConfig } from '@playwright/test'

const DATABASE_URL = 'e2e.db'
// The user-level state directory (registry) and the Campaign folders, thrown away each run.
const E2E_DIR = path.resolve('.e2e')
export const E2E_HOME = path.join(E2E_DIR, 'home')
export const E2E_CAMPAIGNS = path.join(E2E_DIR, 'campaigns')

export default defineConfig({
  // Every spec shares the one SQLite file the preview server runs on.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  webServer: {
    command: `rm -rf ${DATABASE_URL} "${E2E_DIR}" && npm run build && npm run preview`,
    port: 4173,
    env: {
      DATABASE_URL,
      DUNGEON_MASTER_HOME: E2E_HOME,
      DUNGEON_MASTER_CAMPAIGNS: E2E_CAMPAIGNS,
      // The runtime file the bridge reads must name the preview server's port.
      DUNGEON_MASTER_PORT: '4173',
      // Seeded dice, so e2e rolls are deterministic.
      DICE_SEED: '1'
    }
  },
  use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' },
  testMatch: '**/*.e2e.{ts,js}'
})
