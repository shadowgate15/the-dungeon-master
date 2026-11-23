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

  describe('entry by handle', () => {
    it('resolves a monster handle to its full stat block', () => {
      const goblin = repo.entry('monster:goblin')!

      expect(goblin).toMatchObject({ handle: 'monster:goblin', kind: 'monster', name: 'Goblin' })
      expect(goblin.entry).toMatchObject({
        hitPoints: 7,
        armorClass: [{ type: 'armor', value: 15 }],
        abilityScores: { dex: 14 },
        challengeRating: 0.25
      })
      expect(goblin.kind === 'monster' && goblin.entry.actions).toHaveLength(2)
    })

    it('resolves conditions, spells, magic items and rules sections', () => {
      expect(repo.entry('condition:prone')).toMatchObject({ kind: 'condition', name: 'Prone' })
      expect(repo.entry('spell:fireball')).toMatchObject({
        kind: 'spell',
        entry: { level: 3, school: 'evocation' }
      })
      expect(repo.entry('magic-item:bag-of-holding')).toMatchObject({
        kind: 'magic-item',
        entry: { rarity: 'Uncommon', category: 'wondrous-items' }
      })
      expect(repo.entry('rule:cover')).toMatchObject({
        kind: 'rule',
        name: 'Cover',
        entry: { rule: 'combat' }
      })
    })

    it('returns null for an unknown kind, an unknown slug or a malformed handle', () => {
      expect(repo.entry('monster:no-such-monster')).toBeNull()
      expect(repo.entry('npc:mira-voss')).toBeNull()
      expect(repo.entry('goblin')).toBeNull()
    })
  })

  describe('search', () => {
    const handles = (query: string, options?: { limit?: number }) =>
      repo.search(query, options).map((r) => r.handle)

    it('ranks the entry named by the query first, in whichever kind it lives', () => {
      expect(handles('goblin')[0]).toBe('monster:goblin')
      expect(handles('prone')[0]).toBe('condition:prone')
      expect(handles('Fireball')[0]).toBe('spell:fireball')
      expect(handles('bag of holding')[0]).toBe('magic-item:bag-of-holding')
      expect(handles('cover')[0]).toBe('rule:cover')
    })

    it('returns a handle, kind, name and snippet for each match', () => {
      expect(repo.search('prone')[0]).toMatchObject({
        handle: 'condition:prone',
        kind: 'condition',
        name: 'Prone',
        snippet: expect.stringContaining('crawl')
      })
    })

    it('matches the text of an entry, not only its name, across kinds', () => {
      const found = handles('three-quarters cover')
      expect(found).toContain('rule:cover')

      const kinds = new Set(repo.search('fire', { limit: 50 }).map((r) => r.kind))
      expect(kinds).toEqual(new Set(['spell', 'monster', 'magic-item']))
    })

    it('matches other forms of a word', () => {
      expect(handles('grappling')).toContain('condition:grappled')
    })

    it('honours the limit and returns nothing for a query with no words', () => {
      expect(handles('dragon', { limit: 3 })).toHaveLength(3)
      expect(repo.search('  "*?  ')).toEqual([])
      expect(repo.search('xyzzyplugh')).toEqual([])
    })
  })
})
