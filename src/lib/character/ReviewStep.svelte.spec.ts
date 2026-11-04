import { page } from 'vitest/browser'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import alignments from '#lib/rules/data/alignments.json'
import backgrounds from '#lib/rules/data/backgrounds.json'
import classLevels from '#lib/rules/data/classLevels.json'
import classes from '#lib/rules/data/classes.json'
import equipment from '#lib/rules/data/equipment.json'
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
import ReviewStep from './ReviewStep.svelte'
import { CharacterWizard } from './wizard.svelte.ts'

const rules = {
  alignments,
  backgrounds,
  classLevels,
  classes,
  equipment,
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

function readyWizard() {
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
  return wizard
}

afterEach(() => vi.unstubAllGlobals())

describe('ReviewStep save', () => {
  it('posts the mapped CharacterInput and, when the save fails, shows the error and keeps the draft', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: 'Name is required' }, { status: 400 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const wizard = readyWizard()
    render(ReviewStep, { wizard })

    await page.getByRole('button', { name: 'Save Character' }).click()

    await expect.element(page.getByRole('alert')).toHaveTextContent('Name is required')
    expect(wizard.draft.name).toBe('Brannoch')
    expect(wizard.dirty).toBe(true)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }]
    const sent = JSON.parse(init.body)
    expect(sent).toMatchObject({
      name: 'Brannoch',
      abilityMethod: 'standard-array',
      scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
    })
  })
})
