import type { Preview } from '@storybook/sveltekit'
import QueryDecorator from './QueryDecorator.svelte'
import '../src/routes/layout.css'

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
          { value: 'system', title: 'System' }
        ],
        dynamicTitle: true
      }
    }
  },
  initialGlobals: { theme: 'system' },
  decorators: [
    (story, context) => {
      // The tokens key off data-theme on <html>; no attribute means follow the OS.
      const theme = context.globals.theme
      const root = document.documentElement
      if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme)
      else root.removeAttribute('data-theme')
      return { Component: QueryDecorator, props: { children: story } }
    }
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  }
}

export default preview
