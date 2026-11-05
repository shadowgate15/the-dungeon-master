import { page } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import StepRail, { type RailStep } from './StepRail.svelte'

const steps: RailStep[] = [
  { id: 'concept', label: 'Concept', status: 'valid' },
  { id: 'abilities', label: 'Ability scores', status: 'incomplete' },
  { id: 'skills', label: 'Skills & features', status: 'attention', issues: ['Too many skills.'] },
  { id: 'equipment', label: 'Equipment', status: 'locked' },
  { id: 'review', label: 'Review', status: 'locked' }
]
const props = { steps, current: 'abilities' as const, onselect: () => {}, onabandon: () => {} }

describe('StepRail', () => {
  it('names each step with its status', async () => {
    render(StepRail, props)

    await expect.element(page.getByRole('button', { name: /^1\. Concept\s*, valid/ })).toBeVisible()
    await expect
      .element(page.getByRole('button', { name: /Ability scores\s*, incomplete/ }))
      .toBeVisible()
    await expect
      .element(page.getByRole('button', { name: /Skills & features\s*, needs attention/ }))
      .toBeVisible()
    await expect.element(page.getByRole('button', { name: /Equipment\s*, locked/ })).toBeVisible()
  })

  it('disables locked steps and enables the rest', async () => {
    render(StepRail, props)

    await expect.element(page.getByRole('button', { name: /Equipment/ })).toBeDisabled()
    await expect.element(page.getByRole('button', { name: /Review/ })).toBeDisabled()
    await expect.element(page.getByRole('button', { name: /Concept/ })).toBeEnabled()
    await expect.element(page.getByRole('button', { name: /Skills/ })).toBeEnabled()
  })

  it('marks the current step', async () => {
    render(StepRail, props)

    await expect
      .element(page.getByRole('button', { name: /Ability scores/ }))
      .toHaveAttribute('aria-current', 'step')
    await expect
      .element(page.getByRole('button', { name: /Concept/ }))
      .not.toHaveAttribute('aria-current')
  })

  it('explains a step that needs attention', async () => {
    render(StepRail, props)

    await expect
      .element(page.getByRole('button', { name: /Skills/ }))
      .toHaveAttribute('title', 'Too many skills.')
  })

  it('shows a dot only on steps with pending suggestions', async () => {
    render(StepRail, {
      ...props,
      steps: steps.map((s) => (s.id === 'abilities' ? { ...s, suggestions: 2 } : s))
    })

    await expect.element(page.getByTestId('suggestion-dot')).toBeInTheDocument()
    expect(page.getByTestId('suggestion-dot').elements()).toHaveLength(1)
    await expect
      .element(page.getByRole('button', { name: /Ability scores.*incomplete.*AI has suggestions/ }))
      .toBeVisible()
  })

  it('selects a step and asks to abandon', async () => {
    const onselect = vi.fn()
    const onabandon = vi.fn()
    render(StepRail, { ...props, onselect, onabandon })

    await page.getByRole('button', { name: /Skills/ }).click()
    await page.getByRole('button', { name: 'Abandon' }).click()

    expect(onselect).toHaveBeenCalledWith('skills')
    expect(onabandon).toHaveBeenCalled()
  })
})
