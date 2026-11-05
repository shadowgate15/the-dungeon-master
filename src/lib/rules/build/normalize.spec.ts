import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COLLECTIONS, rulesDataset, type RulesDataset } from '../schema.ts'
import { normalize } from './normalize.ts'
import { readUpstream } from './read.ts'

const dataset = normalize(readUpstream())

const committed = (): unknown =>
  Object.fromEntries(
    ['meta', ...COLLECTIONS].map((name) => [
      name,
      JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'))
    ])
  )

const bySlug = <T extends { slug: string }>(rows: T[], slug: string) =>
  rows.find((r) => r.slug === slug)!

describe('Rules Data normalizer', () => {
  it('produces output that validates against the zod schema', () => {
    expect(() => rulesDataset.parse(dataset)).not.toThrow()
  })

  it('matches the committed JSON, so data changes always show up as reviewable diffs', () => {
    expect(committed()).toEqual(dataset)
  })

  it('records the pinned dataset version and tag', () => {
    expect(dataset.meta).toMatchObject({
      sourceRepository: 'https://github.com/5e-bits/5e-database',
      sourceTag: `v${dataset.meta.datasetVersion}`,
      srdVersion: '5.1'
    })
  })

  it('carries every SRD race, class, spell and equipment item, with one subclass per class', () => {
    expect(dataset.races).toHaveLength(9)
    expect(dataset.subraces).toHaveLength(4)
    expect(dataset.classes).toHaveLength(12)
    expect(dataset.subclasses).toHaveLength(12)
    expect(dataset.spells).toHaveLength(319)
    expect(dataset.equipment).toHaveLength(237)
    expect(dataset.skills).toHaveLength(18)
    expect(dataset.features.length).toBeGreaterThan(400)
  })

  it('keeps slugs unique within each collection', () => {
    for (const name of COLLECTIONS) {
      const rows = dataset[name] as { slug?: string }[]
      const slugs = rows.flatMap((r) => (r.slug ? [r.slug] : []))
      expect(new Set(slugs).size, name).toBe(slugs.length)
    }
  })

  it('resolves every cross-reference to a row that exists', () => {
    const has = (rows: { slug: string }[]) => new Set(rows.map((r) => r.slug))
    const d: RulesDataset = dataset
    const classes = has(d.classes)
    const equipment = has(d.equipment)
    const proficiencies = has(d.proficiencies)
    const features = has(d.features)
    const spells = has(d.spells)
    for (const s of d.spells) for (const c of s.classes) expect(classes.has(c)).toBe(true)
    for (const l of d.classLevels) for (const f of l.features) expect(features.has(f)).toBe(true)
    for (const sc of d.subclasses) for (const x of sc.spells) expect(spells.has(x.spell)).toBe(true)
    for (const c of d.classes) {
      for (const p of c.proficiencies) expect(proficiencies.has(p)).toBe(true)
      for (const i of c.startingEquipment) expect(equipment.has(i.item)).toBe(true)
    }
    for (const cat of d.equipmentCategories)
      for (const i of cat.items) expect(equipment.has(i)).toBe(true)
  })

  describe('choice flattening', () => {
    it('turns a class skill list into one proficiency choice group', () => {
      const bard = bySlug(dataset.classes, 'bard')
      const skills = bard.choiceGroups.find((g) => g.kind === 'proficiency' && g.choose === 3)!

      expect(skills.options).toHaveLength(18)
      expect(skills.options[0]).toEqual({
        items: [{ type: 'proficiency', proficiency: 'skill-acrobatics' }]
      })
    })

    it('represents a wildcard as an equipment category item', () => {
      const barbarian = bySlug(dataset.classes, 'barbarian')
      const weapon = barbarian.choiceGroups.find(
        (g) => g.kind === 'equipment' && g.description?.includes('greataxe')
      )!

      expect(weapon.options).toEqual([
        {
          items: [{ type: 'equipment', equipment: 'greataxe', count: 1, requiresProficiency: null }]
        },
        { items: [{ type: 'equipmentCategory', category: 'martial-melee-weapons', count: 1 }] }
      ])
    })

    it('keeps a multi-item option as one bundle', () => {
      const cleric = bySlug(dataset.classes, 'cleric')
      const crossbow = cleric.choiceGroups.find((g) => g.description?.includes('light crossbow'))!

      expect(crossbow.options[0].items).toEqual([
        { type: 'equipment', equipment: 'crossbow-light', count: 1, requiresProficiency: null },
        { type: 'equipment', equipment: 'crossbow-bolt', count: 20, requiresProficiency: null }
      ])
    })

    it('keeps the proficiency condition on a Cleric "if proficient" option', () => {
      const cleric = bySlug(dataset.classes, 'cleric')
      const armor = cleric.choiceGroups.find((g) => g.description?.includes('chain mail'))!

      expect(armor.options.at(-1)!.items[0]).toMatchObject({
        equipment: 'chain-mail',
        requiresProficiency: 'chain-mail'
      })
    })

    it('folds a nested proficiency choice into one flat group', () => {
      const monk = bySlug(dataset.classes, 'monk')
      const tools = monk.choiceGroups.find((g) => g.description?.includes('artisan'))!

      expect(tools.choose).toBe(1)
      expect(tools.options.length).toBeGreaterThan(10)
      expect(
        tools.options.every((o) => o.items.length === 1 && o.items[0].type === 'proficiency')
      ).toBe(true)
    })

    it("flattens Half-Elf's ability bonus options", () => {
      const halfElf = bySlug(dataset.races, 'half-elf')
      const picks = halfElf.choiceGroups.find((g) => g.kind === 'abilityBonus')!

      expect(picks.choose).toBe(2)
      expect(picks.options).toHaveLength(5)
    })
  })

  describe('app-authored data', () => {
    it('defines the three ability score methods and marks them app-authored', () => {
      expect(dataset.abilityScoreMethods.map((m) => m.slug)).toEqual([
        'standard-array',
        'point-buy',
        'roll'
      ])
      expect(bySlug(dataset.abilityScoreMethods, 'standard-array').config).toEqual({
        type: 'standardArray',
        values: [15, 14, 13, 12, 10, 8]
      })
      expect(bySlug(dataset.abilityScoreMethods, 'point-buy').config).toMatchObject({
        budget: 27,
        min: 8,
        max: 15,
        costs: { '8': 0, '9': 1, '10': 2, '11': 3, '12': 4, '13': 5, '14': 7, '15': 9 }
      })
      expect(bySlug(dataset.abilityScoreMethods, 'roll').config).toEqual({
        type: 'roll',
        count: 6,
        dice: 4,
        sides: 6,
        dropLowest: 1
      })
    })

    it('ships Acolyte from the SRD and a custom background authored by the app', () => {
      expect(bySlug(dataset.backgrounds, 'acolyte').appAuthored).toBe(false)
      expect(bySlug(dataset.backgrounds, 'acolyte').options.length).toBeGreaterThan(20)
      expect(bySlug(dataset.backgrounds, 'custom')).toMatchObject({
        appAuthored: true,
        startingGoldQuantity: 15
      })
    })
  })
})
