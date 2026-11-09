import { describe, expect, it } from 'vitest'
import { deriveStats } from '#lib/rules/derive-stats.ts'
import { resolveFeatures } from '#lib/rules/resolver.ts'
import { loadDataset } from '#lib/rules/test-dataset.ts'
import { ownedEquipment } from './equipment.ts'
import { emptyDraft, reconcile, resolverDraft, type CharacterDraft } from './draft.ts'
import { computeSteps, STEPS, type StepContext, type StepDefinition } from './steps.ts'

const rules = loadDataset()

function ctxFor(patch: Partial<CharacterDraft>): StepContext {
  const { draft } = reconcile(rules, { ...emptyDraft(), ...patch })
  const resolved = resolveFeatures(rules, resolverDraft(draft))
  const stats = deriveStats(rules, resolved, {
    class: draft.class,
    level: draft.level,
    baseScores: draft.baseScores,
    equipment: ownedEquipment(rules, draft, resolved)
  })
  return { rules, draft, resolved, stats }
}
const complete = { name: 'Brenna', race: 'human', class: 'fighter', background: 'acolyte' }
const states = (patch: Partial<CharacterDraft>, defs?: readonly StepDefinition[]) =>
  Object.fromEntries(computeSteps(ctxFor(patch), defs).map((s) => [s.id, s.status]))

describe('Concept validity', () => {
  it('is incomplete for an empty draft and lists what is missing', () => {
    const concept = computeSteps(ctxFor({})).find((s) => s.id === 'concept')!
    expect(concept.status).toBe('incomplete')
    expect(concept.issues.join(' ')).toMatch(/name/i)
    expect(concept.issues.join(' ')).toMatch(/race/i)
    expect(concept.issues.join(' ')).toMatch(/class/i)
    expect(concept.issues.join(' ')).toMatch(/background/i)
  })

  it('is valid with a name, race, class and background; details are optional', () => {
    expect(states(complete).concept).toBe('valid')
  })

  it('treats a blank name as missing', () => {
    expect(states({ ...complete, name: '   ' }).concept).toBe('incomplete')
  })

  it('requires a subrace when the race has one', () => {
    expect(states({ ...complete, race: 'elf' }).concept).toBe('incomplete')
    expect(states({ ...complete, race: 'elf', subrace: 'high-elf' }).concept).toBe('valid')
  })

  it('needs no subrace for a race without any', () => {
    expect(states({ ...complete, race: 'human' }).concept).toBe('valid')
  })

  it('is valid for a class whose single subclass was preselected', () => {
    expect(states({ ...complete, class: 'cleric' }).concept).toBe('valid')
  })

  it('needs attention when a detail is over its length limit', () => {
    const concept = states({ ...complete, appearance: 'x'.repeat(501) })
    expect(concept.concept).toBe('attention')
  })
})

describe('Skills & features validity', () => {
  const picks = {
    'class/fighter/proficiency-0': ['skill-athletics', 'skill-intimidation'],
    'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
    'race/human/language-0': ['dwarvish'],
    'background/acolyte/language-0': ['elvish', 'gnomish']
  }
  const skills = (patch: Partial<CharacterDraft>) =>
    computeSteps(ctxFor({ ...complete, ...patch })).find((s) => s.id === 'skills')!

  it('is incomplete with exact counts missing, and names what is missing', () => {
    const s = skills({})
    expect(s.status).toBe('incomplete')
    expect(s.issues.join(' ')).toMatch(/Fighting Style/i)
  })

  it('is incomplete when a group has fewer picks than its count', () => {
    expect(
      skills({ picks: { ...picks, 'class/fighter/proficiency-0': ['skill-athletics'] } }).status
    ).toBe('incomplete')
  })

  it('is valid with every pick made', () => {
    expect(skills({ picks }).status).toBe('valid')
  })

  it('needs attention (blocking Review) when a pick repeats another source', () => {
    const s = skills({
      picks: { ...picks, 'background/acolyte/language-0': ['common', 'gnomish'] }
    })
    expect(s.status).toBe('attention')
    expect(s.issues.join(' ')).toMatch(/Common/)
  })

  it('does not count the subclass chooser or spell picks', () => {
    expect(skills({ class: 'cleric', picks: {} }).issues.join(' ')).not.toMatch(/Divine Domain/)
  })

  describe('custom background', () => {
    const custom = {
      background: 'custom',
      customBackgroundName: 'Wanderer',
      customBackgroundFeature: 'You know the roads.',
      picks: {
        ...picks,
        'background/custom/skills-0': ['skill-arcana', 'skill-history'],
        'background/custom/toolsOrLanguages-0': ['thieves-tools', 'halfling']
      }
    }

    it('is valid with a name, a feature and the exact picks', () => {
      expect(skills(custom).status).toBe('valid')
    })

    it('requires a name and a feature', () => {
      const noName = skills({ ...custom, customBackgroundName: ' ' })
      expect(noName.status).toBe('incomplete')
      expect(noName.issues.join(' ')).toMatch(/name/i)
      const noFeature = skills({ ...custom, customBackgroundFeature: '' })
      expect(noFeature.issues.join(' ')).toMatch(/feature/i)
    })

    it('needs attention when the text is over its limit', () => {
      expect(skills({ ...custom, customBackgroundName: 'x'.repeat(81) }).status).toBe('attention')
      expect(skills({ ...custom, customBackgroundFeature: 'x'.repeat(1001) }).status).toBe(
        'attention'
      )
    })
  })
})

describe('step statuses and gating', () => {
  it('locks every step after Concept until Concept is valid', () => {
    expect(states({})).toMatchObject({
      concept: 'incomplete',
      abilities: 'locked',
      skills: 'locked',
      equipment: 'locked',
      review: 'locked'
    })
  })

  it('opens the later steps once Concept is valid, but keeps Review locked', () => {
    const s = states(complete)
    expect(s.abilities).not.toBe('locked')
    expect(s.skills).not.toBe('locked')
    expect(s.equipment).not.toBe('locked')
    expect(s.review).toBe('locked')
  })

  it('skips the Spells step for a class that does not cast at level 1', () => {
    expect(computeSteps(ctxFor(complete)).map((s) => s.id)).not.toContain('spells')
  })

  it('shows the Spells step for a caster', () => {
    const ids = computeSteps(ctxFor({ ...complete, class: 'wizard' })).map((s) => s.id)
    expect(ids).toContain('spells')
  })

  it('unlocks Review only when every other step is valid', () => {
    const always = (id: StepDefinition['id'], label: string): StepDefinition => ({
      id,
      label,
      validate: () => ({ state: 'valid', issues: [] })
    })
    const stub = (state: 'valid' | 'attention'): StepDefinition[] =>
      STEPS.map((d) =>
        d.id === 'concept' || d.id === 'review'
          ? d
          : { ...always(d.id, d.label), validate: () => ({ state, issues: [] }) }
      )
    expect(states(complete, stub('attention')).review).toBe('locked')
    expect(states(complete, stub('valid')).review).not.toBe('locked')
  })
})
