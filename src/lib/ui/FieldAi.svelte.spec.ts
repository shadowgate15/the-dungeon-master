import { page, userEvent } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import FieldAi from './FieldAi.svelte'

const options = [
  { value: 'elf', label: 'Elf' },
  { value: 'dwarf', label: 'Dwarf' }
]

function callbacks() {
  return {
    onGenerate: vi.fn(),
    onFeedback: vi.fn(),
    onStop: vi.fn(),
    onRetry: vi.fn(),
    onDismiss: vi.fn(),
    onUndo: vi.fn()
  }
}

describe('FieldAi', () => {
  describe('idle', () => {
    it.each([
      ['text', 'textbox'],
      ['textarea', 'textbox'],
      ['enum', 'combobox']
    ] as const)('renders a %s field with the icon pair', async (kind, role) => {
      render(FieldAi, { label: 'Premise', kind, value: 'elf', options, ...callbacks() })

      await expect.element(page.getByRole(role, { name: 'Premise' })).toBeVisible()
      await expect.element(page.getByRole('button', { name: 'Generate Premise' })).toBeVisible()
      await expect
        .element(page.getByRole('button', { name: 'Give feedback on Premise' }))
        .toBeVisible()
    })

    it('lists the options of an enum field', async () => {
      render(FieldAi, { label: 'Race', kind: 'enum', value: 'elf', options, ...callbacks() })

      await expect.element(page.getByRole('option', { name: 'Dwarf' })).toBeInTheDocument()
    })

    it('submits its value under the given form name', async () => {
      render(FieldAi, {
        label: 'Name',
        name: 'name',
        kind: 'text',
        value: 'Eldoria',
        ...callbacks()
      })

      const input = page.getByRole('textbox', { name: 'Name' }).element() as HTMLInputElement

      expect(input.name).toBe('name')
    })

    it('calls onGenerate when Generate is clicked', async () => {
      const cb = callbacks()
      render(FieldAi, { label: 'Name', kind: 'text', value: '', ...cb })

      await page.getByRole('button', { name: 'Generate Name' }).click()

      expect(cb.onGenerate).toHaveBeenCalledOnce()
    })

    it('shows tooltips on hover and on keyboard focus', async () => {
      render(FieldAi, { label: 'Name', kind: 'text', value: 'Ash', ...callbacks() })

      await page.getByRole('button', { name: 'Generate Name' }).hover()
      await expect.element(page.getByRole('tooltip')).toHaveTextContent('Generate name')

      await userEvent.unhover(page.getByRole('button', { name: 'Generate Name' }))
      await expect.element(page.getByRole('tooltip')).not.toBeInTheDocument()

      page.getByRole('button', { name: 'Give feedback on Name' }).element().focus()
      await expect.element(page.getByRole('tooltip')).toHaveTextContent('Give feedback on name')
    })
  })

  describe('feedback popover', () => {
    it('opens a labelled dialog showing the current value, with aria-expanded on the trigger', async () => {
      render(FieldAi, { label: 'Name', kind: 'text', value: 'Marrowgate', ...callbacks() })
      const trigger = page.getByRole('button', { name: 'Give feedback on Name' })
      await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')

      await trigger.click()

      await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
      const dialog = page.getByRole('dialog', { name: 'Feedback on Name' })
      await expect.element(dialog).toBeVisible()
      await expect.element(dialog).toHaveTextContent('Marrowgate')
    })

    it('keeps Revise disabled while the note is empty', async () => {
      render(FieldAi, { label: 'Name', kind: 'text', value: 'Ash', ...callbacks() })
      await page.getByRole('button', { name: 'Give feedback on Name' }).click()

      const revise = page.getByRole('button', { name: 'Revise' })
      await expect.element(revise).toBeDisabled()

      await page.getByRole('textbox', { name: 'What should change?' }).fill('  ')
      await expect.element(revise).toBeDisabled()

      await page.getByRole('textbox', { name: 'What should change?' }).fill('darker')
      await expect.element(revise).toBeEnabled()
    })

    it('submits the note with Revise and closes', async () => {
      const cb = callbacks()
      render(FieldAi, { label: 'Name', kind: 'text', value: 'Ash', ...cb })
      await page.getByRole('button', { name: 'Give feedback on Name' }).click()
      await page.getByRole('textbox', { name: 'What should change?' }).fill('darker')

      await page.getByRole('button', { name: 'Revise' }).click()

      expect(cb.onFeedback).toHaveBeenCalledExactlyOnceWith('darker')
      await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
    })

    it('submits with Ctrl+Enter', async () => {
      const cb = callbacks()
      render(FieldAi, { label: 'Name', kind: 'text', value: 'Ash', ...cb })
      await page.getByRole('button', { name: 'Give feedback on Name' }).click()
      await page.getByRole('textbox', { name: 'What should change?' }).fill('shorter')

      await userEvent.keyboard('{Control>}{Enter}{/Control}')

      expect(cb.onFeedback).toHaveBeenCalledExactlyOnceWith('shorter')
    })

    it('does not submit an empty note with Ctrl+Enter', async () => {
      const cb = callbacks()
      render(FieldAi, { label: 'Name', kind: 'text', value: 'Ash', ...cb })
      await page.getByRole('button', { name: 'Give feedback on Name' }).click()

      await userEvent.keyboard('{Control>}{Enter}{/Control}')

      expect(cb.onFeedback).not.toHaveBeenCalled()
    })

    it('closes on Escape and returns focus to the trigger', async () => {
      const cb = callbacks()
      render(FieldAi, { label: 'Name', kind: 'text', value: 'Ash', ...cb })
      const trigger = page.getByRole('button', { name: 'Give feedback on Name' })
      await trigger.click()

      await userEvent.keyboard('{Escape}')

      await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
      await expect.element(trigger).toHaveFocus()
      expect(cb.onFeedback).not.toHaveBeenCalled()
    })

    it('closes with Cancel and on a click outside', async () => {
      render(FieldAi, { label: 'Name', kind: 'text', value: 'Ash', ...callbacks() })
      const trigger = page.getByRole('button', { name: 'Give feedback on Name' })

      await trigger.click()
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()

      await trigger.click()
      await userEvent.click(document.body)
      await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('loading', () => {
    it('swaps the pair for Stop, makes the field pending and announces it', async () => {
      const cb = callbacks()
      render(FieldAi, { label: 'Name', kind: 'text', value: 'Ash', status: 'loading', ...cb })

      await expect
        .element(page.getByRole('button', { name: 'Generate Name' }))
        .not.toBeInTheDocument()
      const field = page.getByRole('textbox', { name: 'Name' })
      await expect.element(field).toBeDisabled()
      await expect.element(field).toHaveAttribute('aria-busy', 'true')
      await expect.element(page.getByRole('status')).toHaveTextContent('Generating name…')

      await page.getByRole('button', { name: 'Stop generating Name' }).click()
      expect(cb.onStop).toHaveBeenCalledOnce()
    })

    it('makes a pending enum field disabled too', async () => {
      render(FieldAi, {
        label: 'Race',
        kind: 'enum',
        value: 'elf',
        options,
        status: 'loading',
        ...callbacks()
      })

      await expect.element(page.getByRole('combobox', { name: 'Race' })).toBeDisabled()
    })
  })

  describe('error', () => {
    it('shows an inline alert with Retry and Dismiss', async () => {
      const cb = callbacks()
      render(FieldAi, {
        label: 'Name',
        kind: 'text',
        value: 'Ash',
        status: 'error',
        error: 'The model timed out.',
        ...cb
      })

      await expect.element(page.getByRole('alert')).toHaveTextContent('The model timed out.')
      await page.getByRole('button', { name: 'Retry' }).click()
      expect(cb.onRetry).toHaveBeenCalledOnce()
      await page.getByRole('button', { name: 'Dismiss' }).click()
      expect(cb.onDismiss).toHaveBeenCalledOnce()
    })

    it('offers only Dismiss when the error is not retryable', async () => {
      render(FieldAi, {
        label: 'Name',
        kind: 'text',
        value: 'Ash',
        status: 'error',
        error: 'A chosen World is archived.',
        retryable: false,
        ...callbacks()
      })

      await expect.element(page.getByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
      await expect.element(page.getByRole('button', { name: 'Dismiss' })).toBeVisible()
    })

    it('keeps the icon pair usable', async () => {
      render(FieldAi, {
        label: 'Name',
        kind: 'text',
        value: 'Ash',
        status: 'error',
        error: 'x',
        ...callbacks()
      })

      await expect.element(page.getByRole('button', { name: 'Generate Name' })).toBeEnabled()
    })
  })

  describe('undo', () => {
    it('announces the update with an Undo action', async () => {
      const cb = callbacks()
      render(FieldAi, { label: 'Name', kind: 'text', value: 'Ash', canUndo: true, ...cb })

      await expect.element(page.getByRole('status')).toHaveTextContent('Name updated by AI.')
      await page.getByRole('button', { name: 'Undo' }).click()
      expect(cb.onUndo).toHaveBeenCalledOnce()
    })

    it('shows no Undo when there is nothing to undo', async () => {
      render(FieldAi, { label: 'Name', kind: 'text', value: 'Ash', ...callbacks() })

      await expect.element(page.getByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    })
  })

  describe('disabled with reason', () => {
    it('disables both icons with the reason in the tooltip, still focusable', async () => {
      const cb = callbacks()
      render(FieldAi, {
        label: 'Name',
        kind: 'text',
        value: 'Ash',
        disabledReason: 'AI is offline. Start LM Studio.',
        ...cb
      })
      const generate = page.getByRole('button', { name: 'Generate Name' })

      await expect.element(generate).toHaveAttribute('aria-disabled', 'true')
      await expect
        .element(page.getByRole('button', { name: 'Give feedback on Name' }))
        .toHaveAttribute('aria-disabled', 'true')

      await generate.click({ force: true })
      expect(cb.onGenerate).not.toHaveBeenCalled()

      generate.element().focus()
      await expect
        .element(page.getByRole('tooltip'))
        .toHaveTextContent('AI is offline. Start LM Studio.')
    })

    it('does not open the popover while disabled', async () => {
      render(FieldAi, {
        label: 'Name',
        kind: 'text',
        value: 'Ash',
        disabledReason: 'Offline',
        ...callbacks()
      })

      await page.getByRole('button', { name: 'Give feedback on Name' }).click({ force: true })

      await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
    })

    it('disables only Feedback on an empty value', async () => {
      render(FieldAi, { label: 'Name', kind: 'text', value: '', ...callbacks() })
      const feedback = page.getByRole('button', { name: 'Give feedback on Name' })

      await expect.element(page.getByRole('button', { name: 'Generate Name' })).toBeEnabled()
      await expect.element(feedback).toHaveAttribute('aria-disabled', 'true')
      feedback.element().focus()
      await expect
        .element(page.getByRole('tooltip'))
        .toHaveTextContent('Nothing to give feedback on yet, use Generate')
    })

    it('makes the field read-only when read-only', async () => {
      render(FieldAi, {
        label: 'Name',
        kind: 'text',
        value: 'Ash',
        readonly: true,
        disabledReason: 'Archived. Restore it to edit.',
        ...callbacks()
      })

      await expect.element(page.getByRole('textbox', { name: 'Name' })).toHaveAttribute('readonly')
    })

    it('disables a read-only enum field', async () => {
      render(FieldAi, {
        label: 'Race',
        kind: 'enum',
        value: 'elf',
        options,
        readonly: true,
        disabledReason: 'Read-only.',
        ...callbacks()
      })

      await expect.element(page.getByRole('combobox', { name: 'Race' })).toBeDisabled()
    })
  })
})
