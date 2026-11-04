import { describe, expect, it } from 'vitest'
import { resolveFeatures } from '#lib/rules/resolver.ts'
import { loadDataset } from '#lib/rules/test-dataset.ts'
import { emptyDraft, reconcile, resolverDraft, type CharacterDraft } from './draft.ts'
import {
  emptyPick,
  equipmentGroups,
  equipmentRows,
  fixedEquipment,
  ownedEquipment,
  validateEquipment
} from './equipment.ts'
import { CharacterWizard } from './wizard.svelte.ts'

const rules = loadDataset()
const base = { name: 'Brenna', race: 'human', class: 'fighter', background: 'acolyte' }

function build(patch: Partial<CharacterDraft>) {
  const { draft, notices } = reconcile(rules, { ...emptyDraft(), ...base, ...patch })
  const resolved = resolveFeatures(rules, resolverDraft(draft))
  return { draft, notices, resolved, groups: equipmentGroups(rules, draft, resolved) }
}
const validate = (patch: Partial<CharacterDraft>) => {
  const { draft, resolved } = build(patch)
  return validateEquipment({ rules, draft, resolved, stats: undefined as never })
}
const key = (n: number, owner = 'class/fighter') => `${owner}/equipment-${n}`

describe('equipment groups', () => {
  it('lists the class groups and the background groups', () => {
    const { groups } = build({})
    expect(groups.map((g) => g.key)).toEqual([
      key(0),
      key(1),
      key(2),
      key(3),
      'background/acolyte/equipment-0'
    ])
  })

  it('describes wildcard slots from the Rules Data category', () => {
    const { groups } = build({})
    const two = groups[1].options[1]
    expect(two.slots).toEqual(['martial-weapons', 'martial-weapons'])
    expect(groups[1].options[0].slots).toEqual(['martial-weapons'])
  })

  it('disables a proficiency-conditional option with a reason', () => {
    const { groups } = build({ class: 'cleric' })
    const hammer = groups.find((g) => g.key === 'class/cleric/equipment-0')!.options[1]
    expect(hammer.disabled).toMatch(/proficiency with Warhammers/)
    const mace = groups.find((g) => g.key === 'class/cleric/equipment-0')!.options[0]
    expect(mace.disabled).toBeNull()
  })

  it('enables a proficiency-conditional option once the proficiency is granted', () => {
    const { groups } = build({ class: 'cleric', subclass: 'life' })
    // Life Domain grants heavy armor, which covers chain mail.
    const chain = groups.find((g) => g.key === 'class/cleric/equipment-1')!.options[2]
    expect(chain.disabled).toBeNull()
  })
})

describe('equipment validity', () => {
  it('is incomplete until every group has an option', () => {
    const v = validate({})
    expect(v.state).toBe('incomplete')
    expect(v.issues.length).toBeGreaterThanOrEqual(4)
  })

  it('requires a legal item for every wildcard slot', () => {
    const { groups } = build({})
    const equipment = {
      [key(0)]: emptyPick(groups[0].options[0]),
      [key(1)]: emptyPick(groups[1].options[1]),
      [key(2)]: emptyPick(groups[2].options[0]),
      [key(3)]: emptyPick(groups[3].options[0]),
      'background/acolyte/equipment-0': { option: 0, wild: ['amulet'] }
    }
    expect(validate({ equipment }).state).toBe('incomplete')
    equipment[key(1)] = { option: 1, wild: ['longsword', 'glaive'] }
    expect(validate({ equipment }).state).toBe('valid')
    equipment[key(1)] = { option: 1, wild: ['longsword', 'club'] } // club is simple
    expect(validate({ equipment }).state).toBe('attention')
  })

  it('picks the only option of a focus group for the player and still needs the variant', () => {
    const { draft } = build({ class: 'paladin' })
    expect(draft.equipment['background/acolyte/equipment-0']).toEqual({ option: 0, wild: [null] })
    expect(draft.equipment['class/paladin/equipment-3']).toEqual({ option: 0, wild: [null] })
  })

  it('flags a picked option that is no longer legal', () => {
    const { draft } = build({
      class: 'cleric',
      equipment: { 'class/cleric/equipment-0': { option: 1, wild: [] } }
    })
    expect(draft.equipment['class/cleric/equipment-0']).toBeDefined()
    expect(validate({ class: 'cleric', equipment: draft.equipment }).state).toBe('attention')
  })
})

describe('equipment outputs', () => {
  const complete = () => {
    const { groups } = build({})
    return {
      [key(0)]: emptyPick(groups[0].options[1]),
      [key(1)]: { option: 1, wild: ['longsword', 'longsword'] },
      [key(2)]: emptyPick(groups[2].options[1]),
      [key(3)]: emptyPick(groups[3].options[0]),
      'background/acolyte/equipment-0': { option: 0, wild: ['amulet'] }
    }
  }

  it('turns picks into stored rows, merging a repeated wildcard item into a quantity', () => {
    const { draft, resolved } = build({ equipment: complete() })
    expect(equipmentRows(rules, draft, resolved)).toEqual([
      { choiceKey: key(0), item: 'leather-armor', quantity: 1 },
      { choiceKey: key(0), item: 'longbow', quantity: 1 },
      { choiceKey: key(0), item: 'arrow', quantity: 20 },
      { choiceKey: key(1), item: 'longsword', quantity: 2 },
      { choiceKey: key(2), item: 'handaxe', quantity: 2 },
      { choiceKey: key(3), item: 'dungeoneers-pack', quantity: 1 },
      { choiceKey: 'background/acolyte/equipment-0', item: 'amulet', quantity: 1 }
    ])
  })

  it('lists fixed class items and the background package read-only', () => {
    const fixed = fixedEquipment(rules, build({ class: 'rogue' }).draft)
    expect(fixed.map((f) => f.source)).toEqual(['class', 'background'])
    expect(fixed[0].items.map((i) => i.item)).toContain('thieves-tools')
    expect(fixed[1].items.map((i) => i.item)).toEqual(['clothes-common', 'pouch'])
  })

  it('owns fixed and picked items', () => {
    const { draft, resolved } = build({ equipment: complete() })
    const owned = ownedEquipment(rules, draft, resolved)
    expect(owned).toEqual(expect.arrayContaining(['longsword', 'pouch', 'longbow']))
  })
})

describe('class change', () => {
  it('clears equipment with a notice', () => {
    const w = new CharacterWizard(rules)
    w.update({ ...base })
    w.update({ equipment: { ...w.draft.equipment, [key(0)]: { option: 0, wild: [] } } })
    expect(w.notices).toEqual([])
    w.update({ class: 'rogue' })
    expect(w.draft.equipment[key(0)]).toBeUndefined()
    expect(w.notices.join(' ')).toMatch(/Cleared your Fighter equipment choices/)
  })

  it('keeps picks for an unchanged class when something else changes', () => {
    const w = new CharacterWizard(rules)
    w.update({ ...base })
    w.update({ equipment: { ...w.draft.equipment, [key(0)]: { option: 0, wild: [] } } })
    w.update({ name: 'Other' })
    expect(w.draft.equipment[key(0)]).toEqual({ option: 0, wild: [] })
    expect(w.notices).toEqual([])
  })

  it('resolves attacks for owned weapons in the wizard stats', () => {
    const w = new CharacterWizard(rules)
    w.update({
      ...base,
      abilityMethod: 'standard-array',
      baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      picks: {
        'class/fighter/proficiency-0': ['skill-athletics', 'skill-perception'],
        'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense']
      }
    })
    w.update({ equipment: { [key(1)]: { option: 1, wild: ['longsword', 'glaive'] } } })
    const attacks = w.stats.attacks
    expect(attacks.status).toBe('ok')
    if (attacks.status === 'ok') {
      expect(attacks.value.map((a) => a.weapon)).toEqual(expect.arrayContaining(['longsword']))
    }
  })
})
