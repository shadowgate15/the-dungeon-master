import { sql } from 'drizzle-orm'
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core'
import { LENGTHS, TONES } from '../../campaign/enums'
import { ABILITIES, ABILITY_METHODS, ALIGNMENTS, PICK_SOURCES } from '../../character/enums'
import {
  background,
  classTable,
  equipment,
  race,
  skill,
  spell,
  subclass,
  subrace
} from './rules-schema'
import { GENRE_FLAVORS, MAGIC_LEVELS, SCALES, TECH_LEVELS } from '../../world/enums'

export const task = sqliteTable('task', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  priority: integer('priority').notNull().default(1)
})

// NULL in an enum column means "unspecified". No user or auth columns yet.
const oneOf = (column: string, values: readonly string[]) =>
  sql.raw(`${column} IS NULL OR ${column} IN (${values.map((v) => `'${v}'`).join(', ')})`)

export const world = sqliteTable(
  'world',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    premise: text('premise'),
    genreFlavor: text('genre_flavor', { enum: GENRE_FLAVORS }),
    scale: text('scale', { enum: SCALES }),
    magicLevel: text('magic_level', { enum: MAGIC_LEVELS }),
    techLevel: text('tech_level', { enum: TECH_LEVELS }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    archivedAt: integer('archived_at')
  },
  () => [
    check('world_genre_flavor_check', oneOf('genre_flavor', GENRE_FLAVORS)),
    check('world_scale_check', oneOf('scale', SCALES)),
    check('world_magic_level_check', oneOf('magic_level', MAGIC_LEVELS)),
    check('world_tech_level_check', oneOf('tech_level', TECH_LEVELS))
  ]
)

export const campaign = sqliteTable(
  'campaign',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    premise: text('premise').notNull(),
    tone: text('tone', { enum: TONES }).notNull(),
    length: text('length', { enum: LENGTHS }).notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    archivedAt: integer('archived_at')
  },
  () => [
    check('campaign_tone_check', oneOf('tone', TONES)),
    check('campaign_length_check', oneOf('length', LENGTHS))
  ]
)

export const worldCampaign = sqliteTable(
  'world_campaign',
  {
    worldId: text('world_id')
      .notNull()
      .references(() => world.id, { onDelete: 'restrict' }),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaign.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.worldId, t.campaignId] })]
)
const ref = (name: string, target: () => AnySQLiteColumn) =>
  integer(name).notNull().references(target, { onDelete: 'restrict' })
const optionalRef = (name: string, target: () => AnySQLiteColumn) =>
  integer(name).references(target, { onDelete: 'restrict' })
const between = (column: string, min: number, max: number) =>
  sql.raw(`${column} BETWEEN ${min} AND ${max}`)

/**
 * A player's hero: the player's choices only. Everything computed from them is derived and never
 * stored. Rules references are integer FKs (RESTRICT). Nothing references a Character except its
 * own child rows, which cascade on delete.
 */
export const character = sqliteTable(
  'character',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    alignment: text('alignment', { enum: ALIGNMENTS }),
    appearance: text('appearance'),
    personality: text('personality'),
    ideal: text('ideal'),
    bond: text('bond'),
    flaw: text('flaw'),
    backstory: text('backstory'),
    level: integer('level').notNull().default(1),
    raceId: ref('race_id', () => race.id),
    subraceId: optionalRef('subrace_id', () => subrace.id),
    classId: ref('class_id', () => classTable.id),
    subclassId: optionalRef('subclass_id', () => subclass.id),
    backgroundId: ref('background_id', () => background.id),
    customBackgroundName: text('custom_background_name'),
    customBackgroundFeature: text('custom_background_feature'),
    abilityMethod: text('ability_method', { enum: ABILITY_METHODS }).notNull(),
    /** Assigned base scores, before racial bonuses. */
    str: integer('str').notNull(),
    dex: integer('dex').notNull(),
    con: integer('con').notNull(),
    int: integer('int').notNull(),
    wis: integer('wis').notNull(),
    cha: integer('cha').notNull(),
    /** Raw dice of the six 4d6 rolls; only when abilityMethod is roll. */
    abilityRolls: text('ability_rolls', { mode: 'json' }).$type<number[][]>(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    archivedAt: integer('archived_at')
  },
  () => [
    check('character_level_check', between('level', 1, 20)),
    check('character_alignment_check', oneOf('alignment', ALIGNMENTS)),
    check('character_ability_method_check', oneOf('ability_method', ABILITY_METHODS)),
    ...ABILITIES.map((a) => check(`character_${a}_check`, between(`"${a}"`, 1, 30)))
  ]
)

const owner = () =>
  text('character_id')
    .notNull()
    .references(() => character.id, { onDelete: 'cascade' })

/** Skills the player picked. Fixed proficiencies are derived. */
export const characterSkill = sqliteTable(
  'character_skill',
  {
    characterId: owner(),
    skillId: ref('skill_id', () => skill.id),
    source: text('source', { enum: PICK_SOURCES }).notNull()
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.skillId] }),
    check('character_skill_source_check', oneOf('source', PICK_SOURCES))
  ]
)

/** Cantrips and level 1 spells picked at creation. Granted spells are derived. */
export const characterSpell = sqliteTable(
  'character_spell',
  {
    characterId: owner(),
    spellId: ref('spell_id', () => spell.id),
    source: text('source', { enum: PICK_SOURCES }).notNull()
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.spellId] }),
    check('character_spell_source_check', oneOf('source', PICK_SOURCES))
  ]
)

/** Resolved items of a class's starting-equipment choice groups; `choiceKey` is the group key. */
export const characterEquipment = sqliteTable(
  'character_equipment',
  {
    characterId: owner(),
    choiceKey: text('choice_key').notNull(),
    itemId: ref('item_id', () => equipment.id),
    quantity: integer('quantity').notNull().default(1)
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.choiceKey, t.itemId] }),
    check('character_equipment_quantity_check', sql.raw('quantity >= 1'))
  ]
)

/**
 * One row per Feature choice pick. `choiceKey` is the Rules Data choice group key
 * (`${ownerType}/${ownerSlug}/${group key}`) and `optionSlug` the picked option. Both are slugs,
 * so they survive reseeds; the service validates them against Rules Data.
 */
export const characterChoice = sqliteTable(
  'character_choice',
  {
    characterId: owner(),
    choiceKey: text('choice_key').notNull(),
    optionSlug: text('option_slug').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.choiceKey, t.optionSlug] }),
    index('character_choice_character_idx').on(t.characterId)
  ]
)

export * from './rules-schema'
