import { beforeAll, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '../db/connect'
import { createRulesRepository, type RulesRepository } from './repository'
import { seedRulesData } from './seed'

let repo: RulesRepository

beforeAll(() => {
  const db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  repo = createRulesRepository(db)
})

describe('RulesRepository', () => {
  it('reports the seeded dataset version and source', () => {
    expect(repo.datasetInfo()).toMatchObject({
      sourceRepository: 'https://github.com/5e-bits/5e-database',
      srdVersion: '5.1'
    })
  })

  it('serves a race with its bonuses, languages, traits and choices', () => {
    const halfElf = repo.race('half-elf')!

    expect(halfElf).toMatchObject({ name: 'Half-Elf', speed: 30, size: 'Medium' })
    expect(halfElf.abilityBonuses).toEqual([{ ability: 'cha', bonus: 2 }])
    expect(halfElf.languages.sort()).toEqual(['common', 'elvish'])
    expect(halfElf.traits).toContain('darkvision')
    expect(halfElf.choiceGroups.find((g) => g.kind === 'abilityBonus')).toMatchObject({ choose: 2 })
    expect(repo.race('no-such-race')).toBeNull()
  })

  it('serves subraces with the race they belong to', () => {
    expect(repo.subraces().find((s) => s.slug === 'high-elf')).toMatchObject({
      race: 'elf',
      abilityBonuses: [{ ability: 'int', bonus: 1 }]
    })
  })

  it('serves a class with saves, proficiencies, spellcasting and starting choices', () => {
    const wizard = repo.classBySlug('wizard')!

    expect(wizard).toMatchObject({ hitDie: 6, spellcastingAbility: 'int' })
    expect(wizard.savingThrows.sort()).toEqual(['int', 'wis'])
    expect(wizard.proficiencies).toContain('daggers')
    expect(wizard.choiceGroups.length).toBeGreaterThan(0)
    expect(repo.classBySlug('barbarian')!.spellcastingAbility).toBeNull()
  })

  it('serves a class level table with slots and the features gained', () => {
    const levels = repo.classLevels('wizard')

    expect(levels).toHaveLength(20)
    expect(levels[0]).toMatchObject({
      level: 1,
      proficiencyBonus: 2,
      slotsLevel1: 2,
      cantripsKnown: 3
    })
    expect(levels[0].features).toContain('spellcasting-wizard')
    expect(repo.classLevels('no-such-class')).toEqual([])
  })

  it('filters spells by level and by class', () => {
    const fireball = repo.spell('fireball')!
    expect(fireball).toMatchObject({ level: 3, school: 'evocation', concentration: false })
    expect(fireball.classes).toEqual(['sorcerer', 'wizard'])

    expect(repo.spells({ level: 0, classSlug: 'wizard' }).every((s) => s.level === 0)).toBe(true)
    expect(repo.spells({ classSlug: 'wizard' }).map((s) => s.slug)).toContain('magic-missile')
    expect(repo.spells({ classSlug: 'barbarian' })).toEqual([])
  })

  it('serves equipment with damage, properties, pack contents and category membership', () => {
    const longsword = repo.equipmentItem('longsword')!
    expect(longsword).toMatchObject({ damageDice: '1d8', damageType: 'slashing' })
    expect(longsword.properties).toEqual(['versatile'])
    expect(longsword.categories).toContain('martial-weapons')

    expect(repo.equipmentItem('chain-mail')).toMatchObject({ armorClassBase: 16 })
    expect(repo.equipmentItem('explorers-pack')!.contents).toContainEqual({
      item: 'rope-hempen-50-feet',
      quantity: 1
    })
    expect(repo.equipment({ categorySlug: 'martial-weapons' }).map((e) => e.slug)).toContain(
      'longsword'
    )
  })

  it('serves the three app-authored ability score methods', () => {
    expect(repo.abilityScoreMethods().map((m) => m.slug)).toEqual([
      'standard-array',
      'point-buy',
      'roll'
    ])
  })

  it('serves the seeded custom background alongside the SRD one', () => {
    expect(repo.background('custom')).toMatchObject({ appAuthored: true, startingGoldQuantity: 15 })
    expect(repo.background('acolyte')).toMatchObject({ appAuthored: false })
    expect(repo.background('acolyte')!.options.some((o) => o.kind === 'ideal')).toBe(true)
  })
})
