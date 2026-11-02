import { defineConfig } from '@playwright/test'

const DATABASE_URL = 'e2e.db'
const FAKE_LM_STUDIO_PORT = 1235

export default defineConfig({
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
        LM_STUDIO_MODEL: 'fake-model'
      }
    }
  ],
  use: { baseURL: 'http://localhost:4173' },
  testMatch: '**/*.e2e.{ts,js}'
})
