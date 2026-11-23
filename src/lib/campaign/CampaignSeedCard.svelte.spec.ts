import { page, userEvent } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import CampaignSeedCard from './CampaignSeedCard.svelte'
import { emptyCampaignSeed } from './seed'

describe('CampaignSeedCard', () => {
  it('fills every field by hand', async () => {
    const seed = $state(emptyCampaignSeed())
    render(CampaignSeedCard, { seed })

    await userEvent.fill(page.getByLabelText('Name'), 'Ember Road')
    await userEvent.fill(page.getByLabelText('Premise'), 'Escort a relic across the ash plains.')
    await userEvent.selectOptions(page.getByLabelText('Tone'), 'tense')
    await userEvent.selectOptions(page.getByLabelText('Length'), 'short')

    expect(seed).toEqual({
      name: 'Ember Road',
      premise: 'Escort a relic across the ash plains.',
      tone: 'tense',
      length: 'short'
    })
  })

  it('has no AI controls', async () => {
    render(CampaignSeedCard, { seed: emptyCampaignSeed() })

    await expect.element(page.getByLabelText('Name')).toBeVisible()
    await expect.element(page.getByRole('button', { name: /Generate/ })).not.toBeInTheDocument()
    await expect.element(page.getByRole('button', { name: /feedback/ })).not.toBeInTheDocument()
  })

  it('warns when the premise runs long', async () => {
    render(CampaignSeedCard, { seed: { ...emptyCampaignSeed(), premise: 'x'.repeat(501) } })

    await expect.element(page.getByText(/Premise is long \(501 of about 500/)).toBeVisible()
  })
})
