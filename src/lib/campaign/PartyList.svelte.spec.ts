import { page } from 'vitest/browser'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import type { PartyMember } from '#lib/server/character/party.ts'
import PartyList from './PartyList.svelte'

const brannoch: PartyMember = {
  kind: 'character',
  id: 'ch1',
  name: 'Brannoch',
  status: 'alive',
  description: 'Human Fighter, Acolyte'
}
const wren: PartyMember = {
  kind: 'draft',
  id: 'd1',
  name: 'Wren',
  step: 'abilities',
  stepLabel: 'Ability scores'
}

describe('PartyList', () => {
  it('lists saved Characters and drafts with the step each draft is on', async () => {
    render(PartyList, { campaignId: 'c1', members: [brannoch, wren] })

    const items = page.getByRole('listitem')
    await expect.element(items.nth(0)).toHaveTextContent(/Brannoch.*Human Fighter, Acolyte/)
    await expect.element(items.nth(1)).toHaveTextContent(/Wren.*Draft.*Ability scores/)
  })

  it('opens the wizard for a draft or a saved Character', async () => {
    render(PartyList, { campaignId: 'c1', members: [brannoch, wren] })

    await expect
      .element(page.getByRole('link', { name: /Brannoch/ }))
      .toHaveAttribute('href', '/campaigns/c1/party?character=ch1')
    await expect
      .element(page.getByRole('link', { name: /Wren/ }))
      .toHaveAttribute('href', '/campaigns/c1/party?draft=d1')
  })

  it('names an unnamed draft', async () => {
    render(PartyList, { campaignId: 'c1', members: [{ ...wren, name: '' }] })
    await expect.element(page.getByRole('link', { name: /Unnamed Character/ })).toBeVisible()
  })

  it('says when there is no one yet', async () => {
    render(PartyList, { campaignId: 'c1', members: [] })
    await expect.element(page.getByText('No Characters yet.')).toBeVisible()
  })
})
