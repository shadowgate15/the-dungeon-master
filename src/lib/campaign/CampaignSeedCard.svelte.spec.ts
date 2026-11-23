import { page, userEvent } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import CampaignSeedCard from './CampaignSeedCard.svelte'
import { emptyCampaignSeed } from './seed'

describe('CampaignSeedCard', () => {
  it('fills every field by hand', async () => {
    const seed = $state(emptyCampaignSeed())
    render(CampaignSeedCard, { seed })

    await userEvent.fill(page.getByLabelText('Name', { exact: true }), 'Ember Road')
    await userEvent.fill(page.getByLabelText('Premise'), 'Escort a relic across the ash plains.')
    await userEvent.selectOptions(page.getByLabelText('Tone'), 'tense')
    await userEvent.selectOptions(page.getByLabelText('Length'), 'short')
    await userEvent.fill(page.getByLabelText('World name'), 'Varn')
    await userEvent.selectOptions(page.getByLabelText('Genre flavor'), 'gothic horror')
    await userEvent.selectOptions(page.getByLabelText('Scale'), 'continent')
    await userEvent.selectOptions(page.getByLabelText('Magic level'), 'low')
    await userEvent.selectOptions(page.getByLabelText('Tech level'), 'medieval')

    expect(seed).toEqual({
      name: 'Ember Road',
      premise: 'Escort a relic across the ash plains.',
      tone: 'tense',
      length: 'short',
      worldName: 'Varn',
      genreFlavor: 'gothic horror',
      scale: 'continent',
      magicLevel: 'low',
      techLevel: 'medieval'
    })
  })

  it('has no AI controls', async () => {
    render(CampaignSeedCard, { seed: emptyCampaignSeed() })

    await expect.element(page.getByLabelText('Name', { exact: true })).toBeVisible()
    await expect.element(page.getByRole('button', { name: /Generate/ })).not.toBeInTheDocument()
    await expect.element(page.getByRole('button', { name: /feedback/ })).not.toBeInTheDocument()
  })

  it('warns when the premise runs long', async () => {
    render(CampaignSeedCard, { seed: { ...emptyCampaignSeed(), premise: 'x'.repeat(501) } })

    await expect.element(page.getByText(/Premise is long \(501 of about 500/)).toBeVisible()
  })

  it('shows what a complete Seed still needs', async () => {
    render(CampaignSeedCard, { seed: { ...emptyCampaignSeed(), name: 'Ember Road' } })

    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('Seed incomplete: still needs Premise, Tone and Length.')
  })

  it('says when the Seed is complete', async () => {
    const seed = { ...emptyCampaignSeed(), name: 'E', premise: 'P', tone: 'epic', length: 'long' }
    render(CampaignSeedCard, { seed })

    await expect.element(page.getByRole('status')).toHaveTextContent('Seed complete')
  })

  it('is read-only when disabled', async () => {
    render(CampaignSeedCard, { seed: emptyCampaignSeed(), disabled: true })

    await expect.element(page.getByLabelText('Name', { exact: true })).toBeDisabled()
    await expect.element(page.getByLabelText('Tech level')).toBeDisabled()
  })
})
