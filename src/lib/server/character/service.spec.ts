import { beforeEach, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { openDatabase, migrateDatabase, type Database } from '../db/connect'
import {
  character,
  characterChoice,
  characterEquipment,
  characterSkill,
  characterSpell
} from '../db/schema'
import { seedRulesData } from '../rules/seed'
import {
  CharacterNotFoundError,
  CharacterValidationError,
  createCharacterService,
  type CharacterInput,
  type CharacterService
} from './service'
import { ALIGNMENTS, BACKSTORY_MAX, NAME_MAX, TEXT_MAX } from '#lib/character/enums.ts'

let db: Database
let characters: CharacterService
let clock: number

const scores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }

/** Human Fighter with the Acolyte background: every required group answered. */
const fighter = (over: Partial<CharacterInput> = {}): CharacterInput => ({
  name: 'Brannoch',
  race: 'human',
  class: 'fighter',
  background: 'acolyte',
  abilityMethod: 'standard-array',
  scores,
  picks: {
    'class/fighter/proficiency-0': ['skill-athletics', 'skill-intimidation'],
    'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
    'race/human/language-0': ['dwarvish'],
    'background/acolyte/language-0': ['elvish', 'halfling']
  },
  equipment: [
    { choiceKey: 'class/fighter/equipment-0', item: 'chain-mail' },
    { choiceKey: 'class/fighter/equipment-1', item: 'longsword' },
    { choiceKey: 'class/fighter/equipment-1', item: 'shield' },
    { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-light' },
    { choiceKey: 'class/fighter/equipment-2', item: 'crossbow-bolt', quantity: 20 },
    { choiceKey: 'class/fighter/equipment-3', item: 'dungeoneers-pack' }
  ],
  ...over
})

/** High Elf Wizard: the racial cantrip, three class cantrips and a six-spell spellbook. */
const wizard = (over: Partial<CharacterInput> = {}): CharacterInput => ({
  name: 'Ilyra',
  race: 'elf',
  subrace: 'high-elf',
  class: 'wizard',
  background: 'acolyte',
  abilityMethod: 'standard-array',
  scores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
  picks: {
    'class/wizard/proficiency-0': ['skill-arcana', 'skill-history'],
    'trait/high-elf-cantrip/cantrip-0': ['light'],
    'trait/extra-language/language-0': ['giant'],
    'background/acolyte/language-0': ['dwarvish', 'halfling']
  },
  classSpells: [
    'acid-splash',
    'chill-touch',
    'fire-bolt',
    'alarm',
    'burning-hands',
    'charm-person',
    'color-spray',
    'comprehend-languages',
    'detect-magic'
  ],
  equipment: [
    { choiceKey: 'class/wizard/equipment-0', item: 'quarterstaff' },
    { choiceKey: 'class/wizard/equipment-1', item: 'component-pouch' },
    { choiceKey: 'class/wizard/equipment-2', item: 'scholars-pack' }
  ],
  ...over
})

beforeEach(() => {
  clock = 1000
  db = openDatabase(':memory:')
  migrateDatabase(db)
  seedRulesData(db)
  characters = createCharacterService(db, () => clock)
})

const rejects = (input: CharacterInput, message: RegExp | string) => {
  const before = characters.list().length
  expect(() => characters.create(input)).toThrow(CharacterValidationError)
  expect(() => characters.create(input)).toThrow(message)
  expect(characters.list()).toHaveLength(before)
}

describe('Character service', () => {
  describe('create', () => {
    it('stores the player choices and returns the Character at level 1', () => {
      const created = characters.create(
        fighter({ alignment: 'lawful-good', backstory: 'A guard.' })
      )

      expect(created).toMatchObject({
        name: 'Brannoch',
        alignment: 'lawful-good',
        backstory: 'A guard.',
        level: 1,
        subraceId: null,
        subclassId: null,
        abilityMethod: 'standard-array',
        ...scores,
        abilityRolls: null,
        archivedAt: null,
        createdAt: 1000,
        updatedAt: 1000
      })
      expect(created.id).toBeTruthy()
    })

    it('reads back as slugs, children and the picks it was given', () => {
      const input = fighter()
      const created = characters.create(input)

      const got = characters.get(created.id)!
      expect(got).toMatchObject({
        raceSlug: 'human',
        subraceSlug: null,
        classSlug: 'fighter',
        subclassSlug: null,
        backgroundSlug: 'acolyte'
      })
      expect(got.skills).toEqual([
        { skill: 'athletics', source: 'class' },
        { skill: 'intimidation', source: 'class' }
      ])
      expect(got.picks).toEqual(input.picks)
      expect(got.equipment).toContainEqual({
        choiceKey: 'class/fighter/equipment-2',
        item: 'crossbow-bolt',
        quantity: 20
      })
      expect(got.equipment).toHaveLength(6)
      expect(got.choices).toContainEqual({
        choiceKey: 'class/fighter/fightingStyle-0',
        optionSlug: 'fighter-fighting-style-defense'
      })
      // Skills are not duplicated into character_choice.
      expect(got.choices.some((c) => c.choiceKey.includes('proficiency-0'))).toBe(false)
    })

    it('stores spells with their source and round-trips both kinds', () => {
      const created = characters.create(wizard())

      const got = characters.get(created.id)!
      expect(got.spells.filter((s) => s.source === 'race')).toEqual([
        { spell: 'light', level: 0, source: 'race' }
      ])
      expect(got.spells.filter((s) => s.source === 'class')).toHaveLength(9)
      expect(got.classSpells).toContain('burning-hands')
      expect(got.classSpells).not.toContain('light')
      expect(got.picks['trait/high-elf-cantrip/cantrip-0']).toEqual(['light'])
      expect(got.subraceSlug).toBe('high-elf')
    })

    it('trims text, treats blank optional text as absent and allows duplicate names', () => {
      const a = characters.create(fighter({ name: '  Brannoch  ', appearance: '   ' }))
      expect(a).toMatchObject({ name: 'Brannoch', appearance: null })
      expect(() => characters.create(fighter())).not.toThrow()
    })

    it('accepts every alignment and none', () => {
      for (const alignment of ALIGNMENTS) {
        expect(characters.create(fighter({ alignment })).alignment).toBe(alignment)
      }
      expect(characters.create(fighter({ alignment: null })).alignment).toBeNull()
    })

    it('writes nothing when a check fails', () => {
      rejects(fighter({ equipment: [] }), /equipment-0/)
    })
  })

  describe('validation', () => {
    it('requires a name within the limit', () => {
      rejects(fighter({ name: '   ' }), /Name is required/)
      rejects(fighter({ name: 'x'.repeat(NAME_MAX + 1) }), /Name must be at most/)
      expect(() => characters.create(fighter({ name: 'x'.repeat(NAME_MAX) }))).not.toThrow()
    })

    it('limits the narrative fields', () => {
      for (const field of ['appearance', 'personality', 'ideal', 'bond', 'flaw'] as const) {
        rejects(fighter({ [field]: 'x'.repeat(TEXT_MAX + 1) }), /at most 500/)
      }
      rejects(fighter({ backstory: 'x'.repeat(BACKSTORY_MAX + 1) }), /at most 2000/)
    })

    it('rejects an unknown alignment', () => {
      rejects(fighter({ alignment: 'chaotic-silly' as never }), /alignment/)
    })

    it('rejects unknown race, class, background, subrace and subclass slugs', () => {
      rejects(fighter({ race: 'nope' }), /Unknown race/)
      rejects(fighter({ class: 'nope' }), /Unknown class/)
      rejects(fighter({ background: 'nope' }), /Unknown background/)
      rejects(wizard({ subrace: 'nope' }), /Unknown subrace/)
      rejects(fighter({ subclass: 'nope' }), /Unknown subclass/)
    })

    it('requires a subrace exactly when the race has subraces', () => {
      rejects(wizard({ subrace: null }), /subrace: missing/)
      rejects(wizard({ subrace: 'hill-dwarf' }), /subrace: mismatch/)
    })

    it('requires a subclass for the level 1 choosers and rejects it elsewhere', () => {
      rejects(fighter({ class: 'cleric', picks: {}, equipment: [] }), /subclass: missing/)
      rejects(fighter({ subclass: 'life' }), /subclass/)
    })

    it('requires the custom background fields only for the custom background', () => {
      const picks = {
        'class/fighter/proficiency-0': ['skill-athletics', 'skill-intimidation'],
        'class/fighter/fightingStyle-0': ['fighter-fighting-style-defense'],
        'race/human/language-0': ['dwarvish']
      }
      rejects(fighter({ customBackgroundName: 'Wanderer' }), /only allowed with the custom/)
      rejects(fighter({ background: 'custom', picks }), /Custom background name is required/)
      rejects(
        fighter({ background: 'custom', customBackgroundName: 'Wanderer', picks }),
        /feature is required/
      )
      rejects(
        fighter({
          background: 'custom',
          customBackgroundName: 'x'.repeat(81),
          customBackgroundFeature: 'f',
          picks
        }),
        /at most 80/
      )
      const custom = characters.create(
        fighter({
          background: 'custom',
          customBackgroundName: 'Wanderer',
          customBackgroundFeature: 'You know the roads.',
          picks
        })
      )
      expect(custom).toMatchObject({
        customBackgroundName: 'Wanderer',
        customBackgroundFeature: 'You know the roads.'
      })
    })

    it('rejects an unknown choice key, an unknown option and an incomplete group', () => {
      const base = fighter().picks!
      rejects(fighter({ picks: { ...base, 'class/fighter/nope-9': ['x'] } }), /Unknown choice/)
      rejects(
        fighter({ picks: { ...base, 'class/fighter/fightingStyle-0': ['nope'] } }),
        /invalid pick/
      )
      rejects(
        fighter({ picks: { ...base, 'class/fighter/proficiency-0': ['skill-athletics'] } }),
        /needs 2 pick/
      )
      const withoutLanguage = { ...base }
      delete withoutLanguage['race/human/language-0']
      rejects(fighter({ picks: withoutLanguage }), /needs 1 pick/)
    })

    it('rejects a pick that repeats a granted proficiency', () => {
      const base = fighter().picks!
      rejects(fighter({ picks: { ...base, 'race/human/language-0': ['common'] } }), /invalid pick/)
    })

    it('rejects unknown spells, spells off the class list and spells above level 1', () => {
      rejects(wizard({ classSpells: ['nope'] }), /Unknown spell/)
      rejects(wizard({ classSpells: ['cure-wounds'] }), /not on the wizard list/)
      rejects(wizard({ classSpells: ['fireball'] }), /above level 1/)
      rejects(wizard({ classSpells: ['light', 'fire-bolt'] }), /picked twice/)
    })

    it('checks equipment keys, items, quantities and completeness', () => {
      const gear = fighter().equipment!
      rejects(
        fighter({ equipment: [...gear, { choiceKey: 'class/fighter/nope', item: 'dagger' }] }),
        /Unknown equipment choice/
      )
      rejects(
        fighter({ equipment: [...gear, { choiceKey: 'class/fighter/equipment-3', item: 'nope' }] }),
        /Unknown item/
      )
      rejects(
        fighter({ equipment: gear.map((g) => (g.item === 'shield' ? { ...g, quantity: 0 } : g)) }),
        /quantity/
      )
      rejects(fighter({ equipment: [...gear, gear[0]] }), /listed twice/)
      rejects(fighter({ equipment: gear.slice(0, 3) }), /equipment-2/)
    })
  })

  describe('ability scores', () => {
    it('accepts the standard array in any assignment and rejects anything else', () => {
      expect(() =>
        characters.create(
          fighter({ scores: { str: 8, dex: 10, con: 12, int: 13, wis: 14, cha: 15 } })
        )
      ).not.toThrow()
      rejects(fighter({ scores: { ...scores, str: 16 } }), /Standard array/)
      rejects(fighter({ scores: { ...scores, dex: 15 } }), /Standard array/)
      rejects(fighter({ scores: { ...scores, str: 15.5 } }), /whole number/)
    })

    it('checks point buy bounds and budget', () => {
      const buy = (s: typeof scores) => fighter({ abilityMethod: 'point-buy', scores: s })
      // Three 15s cost exactly the 27 point budget.
      expect(() =>
        characters.create(buy({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 }))
      ).not.toThrow()
      rejects(buy({ str: 15, dex: 15, con: 15, int: 9, wis: 8, cha: 8 }), /28 of 27/)
      rejects(buy({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }), /between 8 and 15/)
      rejects(buy({ str: 7, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }), /between 8 and 15/)
    })

    it('requires rolls to be consistent with the scores', () => {
      const rolls = [
        [6, 5, 3, 1], // 14
        [6, 6, 6, 1], // 18
        [4, 4, 4, 4], // 12 after dropping the lowest: 12
        [3, 3, 2, 1], // 8
        [5, 4, 4, 2], // 13
        [2, 2, 2, 2] // 6
      ]
      const rolled = { str: 18, dex: 14, con: 13, int: 12, wis: 8, cha: 6 }
      const roll = (over: Partial<CharacterInput>) =>
        fighter({ abilityMethod: 'roll', scores: rolled, abilityRolls: rolls, ...over })

      const created = characters.create(roll({}))
      expect(characters.get(created.id)!.abilityRolls).toEqual(rolls)
      characters.delete(created.id)

      rejects(roll({ scores: { ...rolled, str: 17 } }), /rolled totals/)
      rejects(roll({ abilityRolls: null }), /rolls are required/)
      rejects(roll({ abilityRolls: rolls.slice(0, 5) }), /Exactly 6/)
      rejects(roll({ abilityRolls: [[7, 1, 1, 1], ...rolls.slice(1)] }), /1 to 6/)
      rejects(roll({ abilityRolls: [[6, 5, 3], ...rolls.slice(1)] }), /4 dice/)
    })

    it('rejects rolls with any other method', () => {
      rejects(fighter({ abilityRolls: [[1, 1, 1, 1]] }), /only allowed with the roll method/)
    })

    it('rejects an unknown method', () => {
      rejects(fighter({ abilityMethod: 'dice' as never }), /ability method/)
    })
  })

  describe('update', () => {
    it('replaces the fields and every child row', () => {
      const created = characters.create(fighter())
      clock = 2000

      const updated = characters.update(
        created.id,
        wizard({ name: 'Ilyra the Changed', alignment: 'neutral' })
      )

      expect(updated).toMatchObject({
        id: created.id,
        name: 'Ilyra the Changed',
        alignment: 'neutral',
        createdAt: 1000,
        updatedAt: 2000
      })
      const got = characters.get(created.id)!
      expect(got.classSlug).toBe('wizard')
      expect(got.skills.map((s) => s.skill).sort()).toEqual(['arcana', 'history'])
      expect(got.equipment.map((e) => e.item).sort()).toEqual([
        'component-pouch',
        'quarterstaff',
        'scholars-pack'
      ])
      expect(got.choices.map((c) => c.choiceKey)).not.toContain('class/fighter/fightingStyle-0')
      expect(got.spells).toHaveLength(10)
    })

    it('leaves the Character untouched when the edit is invalid', () => {
      const created = characters.create(fighter())
      clock = 2000
      const before = characters.get(created.id)

      expect(() => characters.update(created.id, fighter({ name: '' }))).toThrow(
        CharacterValidationError
      )
      expect(() => characters.update(created.id, fighter({ equipment: [] }))).toThrow(
        CharacterValidationError
      )

      expect(characters.get(created.id)).toEqual(before)
    })

    it('rolls back the scalar update when writing the children fails', () => {
      const created = characters.create(fighter())
      const before = characters.get(created.id)
      // A choice naming a missing character makes the children insert fail after the scalars moved.
      db.run(sql`CREATE TRIGGER fail_choice BEFORE INSERT ON character_choice
        BEGIN SELECT RAISE(ABORT, 'boom'); END`)
      clock = 2000

      expect(() => characters.update(created.id, fighter({ name: 'Renamed' }))).toThrow(/boom/)

      expect(characters.get(created.id)).toEqual(before)
    })

    it('keeps the level', () => {
      const created = characters.create(fighter())
      db.update(character).set({ level: 3 }).where(eq(character.id, created.id)).run()
      expect(characters.update(created.id, fighter()).level).toBe(3)
    })

    it('refuses an archived Character', () => {
      const created = characters.create(fighter())
      characters.archive(created.id)
      expect(() => characters.update(created.id, fighter())).toThrow(
        /archived Character cannot be edited/
      )
    })

    it('throws not-found for a missing Character', () => {
      expect(() => characters.update('missing', fighter())).toThrow(CharacterNotFoundError)
    })
  })

  describe('archive and restore', () => {
    it('archives, hides from the list and restores', () => {
      const a = characters.create(fighter({ name: 'A' }))
      characters.create(fighter({ name: 'B' }))
      clock = 2000

      expect(characters.archive(a.id)).toMatchObject({ archivedAt: 2000, updatedAt: 2000 })
      expect(characters.list().map((c) => c.name)).toEqual(['B'])
      expect(characters.listArchived().map((c) => c.name)).toEqual(['A'])

      clock = 3000
      expect(characters.restore(a.id)).toMatchObject({ archivedAt: null, updatedAt: 3000 })
      expect(characters.list().map((c) => c.name)).toEqual(['A', 'B'])
    })

    it('is idempotent: repeating either does not move the timestamps', () => {
      const a = characters.create(fighter())
      expect(characters.restore(a.id)).toMatchObject({ archivedAt: null, updatedAt: 1000 })

      clock = 2000
      characters.archive(a.id)
      clock = 3000
      expect(characters.archive(a.id)).toMatchObject({ archivedAt: 2000, updatedAt: 2000 })
    })

    it('throws not-found for a missing Character', () => {
      expect(() => characters.archive('missing')).toThrow(CharacterNotFoundError)
      expect(() => characters.restore('missing')).toThrow(CharacterNotFoundError)
    })

    it('leaves an archived Character readable', () => {
      const a = characters.create(fighter())
      characters.archive(a.id)
      expect(characters.get(a.id)).toMatchObject({ name: 'Brannoch' })
    })
  })

  describe('delete', () => {
    it('removes the Character and cascades to every child table', () => {
      const a = characters.create(wizard())
      const b = characters.create(fighter())

      characters.delete(a.id)

      expect(characters.get(a.id)).toBeUndefined()
      const owners = (rows: { characterId: string }[]) => new Set(rows.map((r) => r.characterId))
      expect(owners(db.select().from(characterSkill).all())).toEqual(new Set([b.id]))
      expect(owners(db.select().from(characterSpell).all())).toEqual(new Set())
      expect(owners(db.select().from(characterEquipment).all())).toEqual(new Set([b.id]))
      expect(owners(db.select().from(characterChoice).all())).toEqual(new Set([b.id]))
    })

    it('deletes an archived Character and throws not-found for a missing one', () => {
      const a = characters.create(fighter())
      characters.archive(a.id)
      characters.delete(a.id)
      expect(characters.listArchived()).toEqual([])
      expect(() => characters.delete(a.id)).toThrow(CharacterNotFoundError)
    })
  })

  describe('get and list', () => {
    it('returns undefined for a missing Character', () => {
      expect(characters.get('missing')).toBeUndefined()
    })

    it('lists active Characters oldest first with the names the list shows', () => {
      characters.create(fighter({ name: 'First' }))
      characters.create(wizard({ name: 'Second' }))

      expect(characters.list()).toMatchObject([
        {
          name: 'First',
          raceName: 'Human',
          subraceName: null,
          className: 'Fighter',
          backgroundName: 'Acolyte'
        },
        { name: 'Second', raceName: 'Elf', subraceName: 'High Elf', className: 'Wizard' }
      ])
    })

    it('lists archived Characters most recently archived first', () => {
      const a = characters.create(fighter({ name: 'A' }))
      const b = characters.create(fighter({ name: 'B' }))
      clock = 2000
      characters.archive(a.id)
      clock = 3000
      characters.archive(b.id)
      expect(characters.listArchived().map((c) => c.name)).toEqual(['B', 'A'])
    })
  })
})
