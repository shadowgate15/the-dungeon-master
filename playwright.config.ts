import { defineConfig } from '@playwright/test'

const DATABASE_URL = 'e2e.db'
const FAKE_LM_STUDIO_PORT = 1235

export default defineConfig({
  // The fake LM Studio's scenario and canned chat content are process-wide state.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  webServer: [
    {
      command: 'node src/lib/testing/fake-lm-studio/cli.ts',
      port: FAKE_LM_STUDIO_PORT,
      env: { FAKE_LM_STUDIO_PORT: String(FAKE_LM_STUDIO_PORT), FAKE_LM_STUDIO_MODEL: 'fake-model' }
    },
    {
      command: `rm -f ${DATABASE_URL} && npm run build && npm run preview`,
      port: 4173,
      env: {
        DATABASE_URL,
        LM_STUDIO_BASE_URL: `http://127.0.0.1:${FAKE_LM_STUDIO_PORT}/v1`,
        LM_STUDIO_MODEL: 'fake-model',
        // Seeded dice, so e2e rolls are deterministic.
        DICE_SEED: '1'
      }
    }
  ],
  use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' },
  testMatch: '**/*.e2e.{ts,js}'
})
