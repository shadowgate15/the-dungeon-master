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
