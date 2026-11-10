import { describe, expect, it } from 'vitest'
import { resolveFeatures } from '#lib/rules/resolver.ts'
import { loadDataset } from '#lib/rules/test-dataset.ts'
import { emptyDraft, resolverDraft, type CharacterDraft } from './draft.ts'
import {
  applyGroupValue,
  describeGroupValue,
  groupBlockedReason,
  groupDefinition,
  isGroupField
} from './ai-groups.ts'

const rules = loadDataset()
const draftOf = (patch: Partial<CharacterDraft>): CharacterDraft => ({
  ...emptyDraft(),
  race: 'human',
  background: 'acolyte',
  ...patch
})
const skillKey = (draft: CharacterDraft, owner: string) =>
  resolveFeatures(rules, resolverDraft(draft)).groups.find(
    (g) => g.kind === 'skill' && g.ownerType === owner
  )!.key

describe('group fields', () => {
  it('recognises pick group field names', () => {
    expect(isGroupField('picks:class/fighter/proficiency-0')).toBe(true)
    expect(isGroupField('equipment:class/fighter/equipment-0')).toBe(true)
    expect(isGroupField('classSpells:cantrips')).toBe(true)
    expect(isGroupField('name')).toBe(false)
  })
})

describe('skill pick groups', () => {
  const draft = draftOf({ class: 'fighter' })
  const key = skillKey(draft, 'class')
  const field = `picks:${key}`

  it('builds the exact count and the legal options', () => {
    const def = groupDefinition(rules, draft, field)
    expect(def?.kind).toBe('picks')
    if (def?.kind !== 'picks') return
    expect(def.count).toBe(2)
    expect(def.options.length).toBeGreaterThan(2)
    for (const o of def.options) expect(o.slug).toMatch(/^skill-/)
    expect(groupBlockedReason(def, draft)).toBeUndefined()
  })

  it('leaves out options that are granted elsewhere', () => {
    const granted = resolveFeatures(rules, resolverDraft(draft))
      .groups.find((g) => g.key === key)!
      .options.filter((o) => o.disabled)
      .map((o) => o.slug)
    expect(granted.length).toBeGreaterThan(0)
    const def = groupDefinition(rules, draft, field)
    for (const slug of granted) {
      expect(def?.kind === 'picks' && def.options.map((o) => o.slug)).not.toContain(slug)
    }
  })

  it('reads the current picks and writes a replacement', () => {
    const picked = draftOf({ class: 'fighter', picks: { [key]: ['skill-arcana'] } })
    const def = groupDefinition(rules, picked, field)!
    expect(def.kind === 'picks' && def.current).toEqual(['skill-arcana'])
    expect(applyGroupValue(rules, picked, field, ['skill-history', 'skill-athletics'])).toEqual({
      picks: { [key]: ['skill-history', 'skill-athletics'] }
    })
  })

  it('has no definition for a group the draft does not own', () => {
    expect(groupDefinition(rules, draftOf({ class: 'cleric' }), field)).toBeUndefined()
  })

  it('describes picks by name', () => {
    const def = groupDefinition(rules, draft, field)!
    expect(describeGroupValue(def, ['skill-history'])).toMatch(/History/)
    expect(describeGroupValue(def, [])).toBe('')
  })
})

describe('class spell groups', () => {
  it('counts cantrips and level 1 spells for a caster and lists the class list', () => {
    const draft = draftOf({ class: 'wizard' })
    const cantrips = groupDefinition(rules, draft, 'classSpells:cantrips')
    const spells = groupDefinition(rules, draft, 'classSpells:spells')
    expect(cantrips?.kind === 'picks' && cantrips.count).toBe(3)
    expect(spells?.kind === 'picks' && spells.count).toBe(6)
    expect(cantrips?.kind === 'picks' && cantrips.options.length).toBeGreaterThan(3)
  })

  it('is blocked with a reason before a class is chosen', () => {
    const draft = draftOf({})
    const def = groupDefinition(rules, draft, 'classSpells:cantrips')
    expect(groupBlockedReason(def, draft)).toBe('Choose a class first')
  })

  it('replaces only its own level and keeps the other level', () => {
    const draft = draftOf({ class: 'wizard', classSpells: ['fire-bolt', 'sleep'] })
    const patch = applyGroupValue(rules, draft, 'classSpells:cantrips', [
      'light',
      'mage-hand',
      'prestidigitation'
    ])
    expect(patch).toEqual({ classSpells: ['sleep', 'light', 'mage-hand', 'prestidigitation'] })
  })
})

describe('equipment groups', () => {
  const key = 'class/fighter/equipment-1'
  const field = `equipment:${key}`

  it('offers the options and the legal items per wildcard slot', () => {
    const def = groupDefinition(rules, draftOf({ class: 'fighter' }), field)
    expect(def?.kind).toBe('equipment')
    if (def?.kind !== 'equipment') return
    expect(def.options).toHaveLength(2)
    expect(def.options[0].slots).toHaveLength(1)
    expect(def.options[1].slots).toHaveLength(2)
    const slugs = def.items['martial-weapons'].map((i) => i.slug)
    expect(slugs).toContain('longsword')
    expect(slugs).not.toContain('club')
  })

  it('is not blocked while some option is open', () => {
    const cleric = draftOf({ class: 'cleric' })
    const def = groupDefinition(rules, cleric, 'equipment:class/cleric/equipment-0')
    expect(groupBlockedReason(def, cleric)).toBeUndefined()
  })

  it('writes an option with wild items', () => {
    const patch = applyGroupValue(rules, draftOf({ class: 'fighter' }), field, {
      option: 0,
      wild: ['longsword']
    })
    expect(patch).toEqual({ equipment: { [key]: { option: 0, wild: ['longsword'] } } })
  })

  it('describes the chosen option and its wild items', () => {
    const def = groupDefinition(rules, draftOf({ class: 'fighter' }), field)!
    expect(describeGroupValue(def, { option: 0, wild: ['longsword'] })).toMatch(/Longsword/)
    expect(describeGroupValue(def, null)).toBe('')
  })
})
