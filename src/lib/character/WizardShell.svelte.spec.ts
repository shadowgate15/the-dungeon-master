import { page } from 'vitest/browser'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import alignments from '#lib/rules/data/alignments.json'
import backgrounds from '#lib/rules/data/backgrounds.json'
import classLevels from '#lib/rules/data/classLevels.json'
import classes from '#lib/rules/data/classes.json'
import equipment from '#lib/rules/data/equipment.json'
import equipmentCategories from '#lib/rules/data/equipmentCategories.json'
import features from '#lib/rules/data/features.json'
import languages from '#lib/rules/data/languages.json'
import proficiencies from '#lib/rules/data/proficiencies.json'
import races from '#lib/rules/data/races.json'
import skills from '#lib/rules/data/skills.json'
import spells from '#lib/rules/data/spells.json'
import subclassLevels from '#lib/rules/data/subclassLevels.json'
import subclasses from '#lib/rules/data/subclasses.json'
import subraces from '#lib/rules/data/subraces.json'
import traits from '#lib/rules/data/traits.json'
import type { WizardRules } from './draft.ts'
import WizardShell from './WizardShell.harness.svelte'
import { CharacterWizard, type WizardTarget } from './wizard.svelte.ts'

const rules = {
  alignments,
  backgrounds,
  classLevels,
  classes,
  equipment,
  equipmentCategories,
  features,
  languages,
  proficiencies,
  races,
  skills,
  spells,
  subclassLevels,
  subclasses,
  subraces,
  traits
} as unknown as WizardRules

function setup() {
  const onabandon = vi.fn()
  const wizard = new CharacterWizard(rules)
  render(WizardShell, { wizard, backHref: '/', onabandon })
  return { wizard, onabandon }
}

describe('WizardShell with the Concept step', () => {
  it('has no AI controls', async () => {
    setup()

    await expect.element(page.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible()
    await expect.element(page.getByRole('button', { name: /Generate/ })).not.toBeInTheDocument()
    await expect.element(page.getByRole('button', { name: /feedback/ })).not.toBeInTheDocument()
  })

  it('starts on Concept with the later steps locked', async () => {
    setup()

    await expect.element(page.getByRole('heading', { name: 'Concept' })).toBeVisible()
    await expect.element(page.getByRole('button', { name: /Ability scores/ })).toBeDisabled()
    await expect.element(page.getByRole('button', { name: /Review/ })).toBeDisabled()
  })

  it('names the steps keeping Review locked once Concept is done', async () => {
    const { wizard } = setup()
    await expect.element(page.getByTestId('review-blockers')).toHaveTextContent(/Concept/)

    wizard.update({ name: 'Brenna', race: 'human', class: 'fighter', background: 'acolyte' })

    const note = page.getByTestId('review-blockers')
    await expect.element(note).toHaveTextContent(/Ability scores, Skills & features, Equipment/)
    await expect.element(note).not.toHaveTextContent(/Concept/)
  })

  it('offers a subrace only for races that have one', async () => {
    setup()

    await expect
      .element(page.getByRole('combobox', { name: 'Subrace', exact: true }))
      .not.toBeInTheDocument()
    await page.getByRole('combobox', { name: 'Race', exact: true }).selectOptions('elf')
    await expect.element(page.getByRole('combobox', { name: 'Subrace', exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: 'Race', exact: true }).selectOptions('human')
    await expect
      .element(page.getByRole('combobox', { name: 'Subrace', exact: true }))
      .not.toBeInTheDocument()
  })

  it('preselects a class with a single subclass option', async () => {
    setup()

    await page.getByRole('combobox', { name: 'Class', exact: true }).selectOptions('cleric')

    await expect
      .element(page.getByRole('combobox', { name: 'Subclass', exact: true }))
      .toHaveValue('life')
  })

  it('unlocks the later steps once Concept is valid', async () => {
    setup()

    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Brenna')
    await page.getByRole('combobox', { name: 'Race', exact: true }).selectOptions('human')
    await page.getByRole('combobox', { name: 'Class', exact: true }).selectOptions('fighter')
    await expect.element(page.getByRole('button', { name: /Ability scores/ })).toBeDisabled()
    await page.getByRole('combobox', { name: 'Background', exact: true }).selectOptions('acolyte')

    await expect.element(page.getByRole('button', { name: /Ability scores/ })).toBeEnabled()
    await expect.element(page.getByRole('button', { name: /Concept\s*, valid/ })).toBeVisible()
  })

  it('fills the stats strip in as the draft grows', async () => {
    setup()

    await expect.element(page.getByRole('group', { name: 'Speed' })).toHaveTextContent('—')
    await page.getByRole('combobox', { name: 'Race', exact: true }).selectOptions('human')

    await expect.element(page.getByRole('group', { name: 'Speed' })).toHaveTextContent('30')
    await expect.element(page.getByRole('group', { name: 'HP' })).toHaveTextContent('—')
  })

  it('tells the player when changing the race clears the subrace', async () => {
    setup()

    await page.getByRole('combobox', { name: 'Race', exact: true }).selectOptions('elf')
    await page.getByRole('combobox', { name: 'Subrace', exact: true }).selectOptions('high-elf')
    await page.getByRole('combobox', { name: 'Race', exact: true }).selectOptions('human')

    await expect.element(page.getByText(/Cleared the subrace High Elf/)).toBeVisible()
    await page.getByRole('button', { name: 'Dismiss' }).click()
    await expect.element(page.getByText(/Cleared the subrace/)).not.toBeInTheDocument()
  })

  it('asks before abandoning and keeps the draft when the player backs out', async () => {
    const { onabandon } = setup()

    await page.getByRole('button', { name: 'Abandon' }).click()
    const dialog = page.getByRole('dialog', { name: 'Abandon this Character?' })
    await expect.element(dialog).toBeVisible()
    await expect.element(dialog).toHaveTextContent(/discards the draft/)
    await dialog.getByRole('button', { name: 'Keep editing' }).click()

    await expect.poll(() => document.querySelector('dialog')?.open).toBe(false)
    expect(onabandon).not.toHaveBeenCalled()
  })

  it('abandons only after the player confirms', async () => {
    const { onabandon } = setup()

    await page.getByRole('button', { name: 'Abandon' }).click()
    await page
      .getByRole('dialog', { name: 'Abandon this Character?' })
      .getByRole('button', { name: 'Abandon' })
      .click()

    expect(onabandon).toHaveBeenCalledOnce()
  })
})

function readyWizard(target: WizardTarget | null = null) {
  const wizard = new CharacterWizard(rules)
  wizard.update({
    name: 'Brannoch',
    race: 'human',
    class: 'fighter',
    background: 'acolyte',
    abilityMethod: 'standard-array',
    baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
  })
  wizard.dirty = true
  if (!target) return wizard
  return new CharacterWizard(rules, undefined, wizard.draft, target)
}

function renderReview(wizard: CharacterWizard) {
  wizard.current = 'review'
  render(WizardShell, { wizard, backHref: '/', onabandon: () => {} })
}

describe('WizardShell with a draft stored with the Campaign', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('writes each change and the current step to the Campaign, then shows it as saved', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const wizard = new CharacterWizard(rules, undefined, undefined, { campaign: 'c1', draft: 'd1' })
    render(WizardShell, { wizard, backHref: '/', onabandon: () => {} })

    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Wren')

    await expect.element(page.getByText('Draft saved')).toBeVisible()
    const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [
      string,
      { method: string; body: string }
    ]
    expect(url).toBe('/api/campaigns/c1/drafts/d1')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toMatchObject({ step: 'concept', draft: { name: 'Wren' } })
    expect(wizard.dirty).toBe(false)
  })
})

describe('WizardShell footer on the Review step', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('offers Save Character in the forward slot instead of a disabled Next', async () => {
    renderReview(readyWizard())

    await expect.element(page.getByRole('button', { name: 'Save Character' })).toBeEnabled()
    await expect.element(page.getByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(page.getByRole('button', { name: 'Save Character' }).elements()).toHaveLength(1)
  })

  it('saves a stored draft with its step and, when the save fails, shows the error and keeps the draft', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: 'Name is required' }, { status: 400 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const wizard = readyWizard({ campaign: 'c1', draft: 'd1' })
    renderReview(wizard)

    await page.getByRole('button', { name: 'Save Character' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent('Name is required')
    expect(wizard.draft.name).toBe('Brannoch')
    const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [
      string,
      { method: string; body: string }
    ]
    expect(url).toBe('/api/campaigns/c1/drafts/d1/save')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({ step: 'review', draft: { name: 'Brannoch' } })
  })

  it('offers Save changes and puts the draft to the saved Character when editing one', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: 'Character not found' }, { status: 400 })
    )
    vi.stubGlobal('fetch', fetchMock)
    renderReview(readyWizard({ campaign: 'c1', character: 'abc-123' }))

    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent('not found')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; body: string }
    ]
    expect(url).toBe('/api/campaigns/c1/characters/abc-123')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toMatchObject({ name: 'Brannoch' })
  })

  it('disables Save and Back while the save is in flight', async () => {
    let finish: (r: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (finish = resolve)))
    )
    renderReview(readyWizard({ campaign: 'c1', draft: 'd1' }))

    await page.getByRole('button', { name: 'Save Character' }).click()

    await expect.element(page.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await expect.element(page.getByRole('button', { name: 'Back' })).toBeDisabled()
    // The rail is another way off Review; it must not leave mid-save either.
    await page.getByRole('button', { name: /Concept/ }).click()
    await expect.element(page.getByRole('heading', { name: 'Review' })).toBeVisible()
    finish(Response.json({ error: 'nope' }, { status: 400 }))
    await expect.element(page.getByRole('button', { name: 'Save Character' })).toBeEnabled()
  })
})
