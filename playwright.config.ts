import { defineConfig } from '@playwright/test'

const DATABASE_URL = 'e2e.db'

export default defineConfig({
  webServer: {
    command: `rm -f ${DATABASE_URL} && npm run build && npm run preview`,
    port: 4173,
    env: { DATABASE_URL }
  },
  testMatch: '**/*.e2e.{ts,js}'
})
