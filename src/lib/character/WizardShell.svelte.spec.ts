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
import WizardShell from './WizardShell.svelte'
import { CharacterWizard } from './wizard.svelte.ts'

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
  it('starts on Concept with the later steps locked', async () => {
    setup()

    await expect.element(page.getByRole('heading', { name: 'Concept' })).toBeVisible()
    await expect.element(page.getByRole('button', { name: /Ability scores/ })).toBeDisabled()
    await expect.element(page.getByRole('button', { name: /Review/ })).toBeDisabled()
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
    await expect.element(dialog).toHaveTextContent(/only in this browser/)
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

  it('renders the conversation slot beside every step when one is given', async () => {
    const { createRawSnippet } = await import('svelte')
    const aside = createRawSnippet(() => ({ render: () => '<p>Chat goes here</p>' }))
    render(WizardShell, {
      wizard: new CharacterWizard(rules),
      backHref: '/',
      onabandon: () => {},
      aside
    })

    await expect
      .element(page.getByRole('complementary', { name: 'Creation conversation' }))
      .toHaveTextContent('Chat goes here')
  })
})

function readyWizard(characterId: string | null = null) {
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
  if (!characterId) return wizard
  return new CharacterWizard(rules, undefined, wizard.draft, characterId)
}

function renderReview(wizard: CharacterWizard) {
  wizard.current = 'review'
  render(WizardShell, { wizard, backHref: '/', onabandon: () => {} })
}

describe('WizardShell footer on the Review step', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('offers Save Character in the forward slot instead of a disabled Next', async () => {
    renderReview(readyWizard())

    await expect.element(page.getByRole('button', { name: 'Save Character' })).toBeEnabled()
    await expect.element(page.getByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(page.getByRole('button', { name: 'Save Character' }).elements()).toHaveLength(1)
  })

  it('posts the mapped CharacterInput and, when the save fails, shows the error and keeps the draft', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: 'Name is required' }, { status: 400 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const wizard = readyWizard()
    renderReview(wizard)

    await page.getByRole('button', { name: 'Save Character' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent('Name is required')
    expect(wizard.draft.name).toBe('Brannoch')
    expect(wizard.dirty).toBe(true)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }]
    expect(JSON.parse(init.body)).toMatchObject({
      name: 'Brannoch',
      abilityMethod: 'standard-array',
      scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
    })
  })

  it('offers Save changes and puts to the saved Character when editing one', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: 'An archived Character cannot be edited' }, { status: 400 })
    )
    vi.stubGlobal('fetch', fetchMock)
    renderReview(readyWizard('abc-123'))

    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent('cannot be edited')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string }]
    expect(url).toBe('/api/characters/abc-123')
    expect(init.method).toBe('PUT')
  })

  it('disables Save and Back while the save is in flight', async () => {
    let finish: (r: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (finish = resolve)))
    )
    renderReview(readyWizard())

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
