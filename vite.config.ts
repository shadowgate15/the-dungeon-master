import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import adapter from '@sveltejs/adapter-node'
import { sveltekit } from '@sveltejs/kit/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

// Every story runs once per theme; the preview reads the theme from VITE_STORYBOOK_THEME.
const storybookProject = (theme: 'light' | 'dark') => ({
  extends: true as const,
  plugins: [
    // The plugin will run tests for the stories defined in your Storybook config
    // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
    storybookTest({
      configDir: path.join(dirname, '.storybook')
    })
  ],
  test: {
    name: `storybook-${theme}`,
    env: { VITE_STORYBOOK_THEME: theme },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),
      instances: [
        {
          browser: 'chromium' as const
        }
      ]
    }
  }
})

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true
      },
      // The game server is a Node server. `pnpm build:plugin` builds it into the plugin root
      // (SERVER_OUT=plugin/server); a plain `pnpm build` leaves the committed build alone.
      adapter: adapter({ out: process.env.SERVER_OUT || 'build' })
    })
  ],
  test: {
    expect: {
      requireAssertions: true
    },
    // Leave half of a developer's machine free while tests run; CI runners have nothing else to do.
    maxWorkers: process.env.CI ? undefined : '50%',
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'client',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [
              {
                browser: 'chromium',
                headless: true
              }
            ]
          },
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**']
        }
      },
      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          globalSetup: ['src/testing/campaign-template.ts'],
          setupFiles: ['src/testing/setup-server.ts'],
          include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
        }
      },
      ...(['light', 'dark'] as const).map(storybookProject)
    ]
  }
})
