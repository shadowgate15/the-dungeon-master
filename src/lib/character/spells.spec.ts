import { describe, expect, it } from 'vitest'
import { deriveStats } from '#lib/rules/derive-stats.ts'
import { resolveFeatures } from '#lib/rules/resolver.ts'
import { loadDataset } from '#lib/rules/test-dataset.ts'
import { emptyDraft, reconcile, resolverDraft, type CharacterDraft } from './draft.ts'
import { ownedEquipment } from './equipment.ts'
import { classSpellOptions, spellAllowance, spellsView, validateSpells } from './spells.ts'
import { computeSteps } from './steps.ts'
import { draftToCharacterInput } from './save.ts'
import { draftToSummaryData } from './summary.ts'

const rules = loadDataset()
const base = { name: 'Ila', race: 'human', background: 'acolyte' }
const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 }

function build(patch: Partial<CharacterDraft>) {
  const { draft, notices } = reconcile(rules, { ...emptyDraft(), ...base, ...patch })
  const resolved = resolveFeatures(rules, resolverDraft(draft))
  const stats = deriveStats(rules, resolved, {
    class: draft.class,
    level: draft.level,
    baseScores: draft.baseScores,
    equipment: ownedEquipment(rules, draft, resolved)
  })
  return { draft, notices, ctx: { rules, draft, resolved, stats } }
}
const validate = (patch: Partial<CharacterDraft>) => validateSpells(build(patch).ctx)
const list = (cls: string, level: number, n: number) =>
  rules.spells
    .filter((s) => s.level === level && s.classes.includes(cls))
    .slice(0, n)
    .map((s) => s.slug)
const HIGH_ELF_KEY = 'trait/high-elf-cantrip/cantrip-0'

describe('spell allowance (#97)', () => {
  it.each([
    ['bard', 2, 4],
    ['sorcerer', 4, 2],
    ['warlock', 2, 2],
    ['wizard', 3, 6],
    ['cleric', 3, 0],
    ['druid', 2, 0],
    ['fighter', 0, 0],
    ['paladin', 0, 0],
    ['ranger', 0, 0]
  ])('%s picks %i cantrips and %i level 1 spells', (cls, cantrips, spells) => {
    expect(spellAllowance(rules, cls)).toMatchObject({ cantrips, spells })
  })

  it('lists only spells of the level on the class list', () => {
    const opts = classSpellOptions(rules, 'wizard', 1)
    expect(opts.length).toBeGreaterThan(0)
    for (const o of opts) {
      const s = rules.spells.find((x) => x.slug === o.slug)!
      expect(s.level).toBe(1)
      expect(s.classes).toContain('wizard')
    }
  })
})

describe('validateSpells', () => {
  it('is incomplete with no picks and says how many are missing', () => {
    const v = validate({ class: 'wizard' })
    expect(v.state).toBe('incomplete')
    expect(v.issues.join(' ')).toMatch(/3 cantrips/)
    expect(v.issues.join(' ')).toMatch(/6 level 1 spells/)
  })

  it('is valid with exact counts, wizard spellbook included', () => {
    const classSpells = [...list('wizard', 0, 3), ...list('wizard', 1, 6)]
    expect(validate({ class: 'wizard', classSpells })).toEqual({ state: 'valid', issues: [] })
  })

  it('needs only cantrips for a cleric', () => {
    expect(validate({ class: 'cleric', classSpells: list('cleric', 0, 3) }).state).toBe('valid')
  })

  it('flags excess instead of dropping it', () => {
    const classSpells = list('cleric', 0, 4)
    const { draft } = build({ class: 'cleric', classSpells })
    expect(draft.classSpells).toEqual(classSpells)
    const v = validate({ class: 'cleric', classSpells })
    expect(v.state).toBe('attention')
    expect(v.issues.join(' ')).toMatch(/pick exactly 3 cantrips, you have 4/i)
  })

  it('flags a pick that is not on the class list, with a reason', () => {
    const wizardOnly = rules.spells.find(
      (s) => s.level === 0 && s.classes.includes('wizard') && !s.classes.includes('cleric')
    )!
    const v = validate({ class: 'cleric', classSpells: [wizardOnly.slug, ...list('cleric', 0, 2)] })
    expect(v.state).toBe('attention')
    expect(v.issues.join(' ')).toContain(wizardOnly.name)
    expect(v.issues.join(' ')).toMatch(/not on the Cleric spell list/)
  })

  it('flags a pick above level 1, a duplicate and an unknown slug', () => {
    const high = rules.spells.find((s) => s.level === 2 && s.classes.includes('cleric'))!.slug
    expect(validate({ class: 'cleric', classSpells: [high, ...list('cleric', 0, 3)] }).state).toBe(
      'attention'
    )
    const c = list('cleric', 0, 2)
    const dup = validate({ class: 'cleric', classSpells: [...c, c[0]] })
    expect(dup.state).toBe('attention')
    expect(dup.issues.join(' ')).toMatch(/twice/)
    expect(
      validate({ class: 'cleric', classSpells: ['not-a-spell', ...list('cleric', 0, 2)] }).state
    ).toBe('attention')
  })

  it('requires the High Elf cantrip and flags it duplicating a class cantrip', () => {
    const high = { race: 'elf', subrace: 'high-elf', class: 'wizard' }
    const cantrips = list('wizard', 0, 3)
    const classSpells = [...cantrips, ...list('wizard', 1, 6)]
    expect(validate({ ...high, classSpells }).state).toBe('incomplete')
    const dup = validate({ ...high, picks: { [HIGH_ELF_KEY]: [cantrips[0]] }, classSpells })
    expect(dup.state).toBe('attention')
    const other = list('wizard', 0, 4)[3]
    expect(validate({ ...high, picks: { [HIGH_ELF_KEY]: [other] }, classSpells }).state).toBe(
      'valid'
    )
  })

  it('asks a High Elf fighter only for the cantrip', () => {
    const high = { race: 'elf', subrace: 'high-elf', class: 'fighter' }
    expect(validate(high).state).toBe('incomplete')
    const picks = { [HIGH_ELF_KEY]: list('wizard', 0, 1) }
    expect(validate({ ...high, picks }).state).toBe('valid')
  })
})

describe('step applicability', () => {
  const ids = (patch: Partial<CharacterDraft>) => computeSteps(build(patch).ctx).map((s) => s.id)

  it('is skipped when there is nothing to pick', () => {
    expect(ids({ class: 'fighter' })).not.toContain('spells')
    expect(ids({ class: 'paladin' })).not.toContain('spells')
  })
  it('is shown for casters and for a High Elf fighter', () => {
    expect(ids({ class: 'bard' })).toContain('spells')
    expect(ids({ class: 'fighter', race: 'elf', subrace: 'high-elf' })).toContain('spells')
  })
})

describe('class change (reconcile)', () => {
  it('keeps picks and flags what the new class cannot take', () => {
    const shared = rules.spells.find(
      (s) => s.level === 0 && s.classes.includes('wizard') && s.classes.includes('bard')
    )!.slug
    const wizardOnly = rules.spells.find(
      (s) => s.level === 0 && s.classes.includes('wizard') && !s.classes.includes('bard')
    )!.slug
    const patch = { class: 'bard', classSpells: [shared, wizardOnly] }
    const { draft, notices, ctx } = build(patch)
    expect(draft.classSpells).toEqual([shared, wizardOnly])
    expect(notices).toEqual([])
    expect(validateSpells(ctx).issues.join(' ')).toMatch(/not on the Bard spell list/)
  })

  it('clears class spells and says so when the new class has no level 1 casting', () => {
    const { draft, notices } = build({ class: 'fighter', classSpells: list('wizard', 0, 3) })
    expect(draft.classSpells).toEqual([])
    expect(notices.join(' ')).toMatch(/spell/i)
  })

  it('keeps the High Elf cantrip when the class stops casting', () => {
    const c = list('wizard', 0, 1)
    const { draft } = build({
      race: 'elf',
      subrace: 'high-elf',
      class: 'fighter',
      picks: { [HIGH_ELF_KEY]: c },
      classSpells: c
    })
    expect(draft.picks[HIGH_ELF_KEY]).toEqual(c)
    expect(draft.classSpells).toEqual([])
  })
})

describe('spellsView', () => {
  it('shows granted spells apart from picks and the prepares hint', () => {
    const view = spellsView(build({ class: 'cleric', baseScores: scores }).ctx)
    expect(view.prepares).toBe(4) // wisdom +3, level 1
    expect(view.granted.length).toBeGreaterThan(0) // Life domain
    expect(view.cantrips.max).toBe(3)
    expect(view.spells.max).toBe(0)
  })
  it('has no prepares hint for a known-spells caster', () => {
    expect(spellsView(build({ class: 'bard' }).ctx).prepares).toBeNull()
  })
})

describe('save and summary mapping', () => {
  const complete = (cls: string, classSpells: string[]) =>
    build({ class: cls, abilityMethod: 'standard-array', baseScores: scores, classSpells }).draft

  it('maps class spells to the service input and the summary', () => {
    const classSpells = list('cleric', 0, 3)
    const draft = complete('cleric', classSpells)
    expect(draftToCharacterInput(rules, draft).classSpells).toEqual(classSpells)
    expect(draftToSummaryData(rules, draft).classSpells).toEqual(classSpells)
  })
  it('sends no class spells for a non-caster', () => {
    expect(draftToCharacterInput(rules, complete('fighter', [])).classSpells).toEqual([])
  })
})
