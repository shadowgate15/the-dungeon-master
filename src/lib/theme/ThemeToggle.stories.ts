import type { Meta, StoryObj } from '@storybook/sveltekit'
import ThemeToggle from './ThemeToggle.svelte'

const meta = {
  title: 'Theme/ThemeToggle',
  component: ThemeToggle,
  args: { theme: 'system' }
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const System: Story = {}

// The Storybook toolbar theme is pinned per story so both themes are shown.
export const Light: Story = { args: { theme: 'light' }, globals: { theme: 'light' } }

export const Dark: Story = { args: { theme: 'dark' }, globals: { theme: 'dark' } }
