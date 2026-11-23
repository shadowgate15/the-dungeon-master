import { defineConfig } from '@playwright/test'

const DATABASE_URL = 'e2e.db'

export default defineConfig({
  // Every spec shares the one SQLite file the preview server runs on.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  webServer: {
    command: `rm -f ${DATABASE_URL} && npm run build && npm run preview`,
    port: 4173,
    env: {
      DATABASE_URL,
      // Seeded dice, so e2e rolls are deterministic.
      DICE_SEED: '1'
    }
  },
  use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' },
  testMatch: '**/*.e2e.{ts,js}'
})
