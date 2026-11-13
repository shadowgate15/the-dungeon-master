import { sql } from 'drizzle-orm'
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'
import { TURN_AUTHORS, TURN_KINDS, type RollRequest, type RollResult } from '../../session/enums'
import { LENGTHS, TONES } from '../../campaign/enums'
import { NPC_STATUSES, STANCES } from '../../memory/enums'
import { ABILITY_KEYS } from '../../rules/registry'
import { ABILITY_METHODS, ALIGNMENTS, PICK_SOURCES } from '../../character/enums'
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
    ...ABILITY_KEYS.map((a) => check(`character_${a}_check`, between(`"${a}"`, 1, 30)))
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

/**
 * A Campaign's linked Character. The app allows one Character per Campaign (enforced in the
 * session service); the schema does not, so a later multiplayer Campaign needs no migration.
 * Deleting a Character with any Session is refused (see the Character service), so only the
 * link of a Character that never played cascades.
 */
export const campaignCharacter = sqliteTable(
  'campaign_character',
  {
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.characterId] })]
)

/**
 * One sitting of play, by one Character. Open while `ended_at` is null; the partial unique index
 * allows at most one open Session per Campaign.
 */
export const session = sqliteTable(
  'session',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    // Restrict: a Character that played is never deleted, since that would erase the transcripts.
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'restrict' }),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    /**
     * The rolling summary of the story so far, written by a separate stateless call. A new
     * Session starts from the previous Session's final summary. Contains no numbers.
     */
    summary: text('summary'),
    /** The last Turn `seq` in this Session the summary already covers; 0 when none. */
    summarizedThroughSeq: integer('summarized_through_seq').notNull().default(0),
    /** The last Turn `seq` in this Session that memory extraction already covers; 0 when none. */
    memoryThroughSeq: integer('memory_through_seq').notNull().default(0)
  },
  (t) => [
    uniqueIndex('session_one_open_per_campaign')
      .on(t.campaignId)
      .where(sql`ended_at IS NULL`)
  ]
)

/**
 * A Session's transcript, append-only. `seq` is monotonic per Session. A DM turn carries
 * narration and optionally an inline Roll request; a player turn is a free-text action or a Roll
 * result. Whether a roll is pending is derived from the last Turn, never stored.
 */
export const turn = sqliteTable(
  'turn',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    author: text('author', { enum: TURN_AUTHORS }).notNull(),
    kind: text('kind', { enum: TURN_KINDS }).notNull(),
    /** Narration (DM) or the typed action (player). Null for a Roll result. */
    text: text('text'),
    /** DM turn only: the inline Roll request. */
    rollRequest: text('roll_request', { mode: 'json' }).$type<RollRequest>(),
    /** Roll result only: the d20, the modifier and the total. */
    rollResult: text('roll_result', { mode: 'json' }).$type<RollResult>(),
    createdAt: integer('created_at').notNull()
  },
  (t) => [
    uniqueIndex('turn_session_seq').on(t.sessionId, t.seq),
    check('turn_author_check', oneOf('author', TURN_AUTHORS)),
    check('turn_kind_check', oneOf('kind', TURN_KINDS))
  ]
)

/**
 * World memory: structured, Campaign-scoped records the DM established. Every record carries
 * its provenance (created and last-changed Session and Turn seq) and is retired by flag, never
 * deleted. Records cascade with their Campaign.
 */
const memoryColumns = () => ({
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaign.id, { onDelete: 'cascade' }),
  createdSessionId: text('created_session_id')
    .notNull()
    .references(() => session.id, { onDelete: 'cascade' }),
  createdSeq: integer('created_seq').notNull(),
  changedSessionId: text('changed_session_id')
    .notNull()
    .references(() => session.id, { onDelete: 'cascade' }),
  changedSeq: integer('changed_seq').notNull(),
  /** Set when the record was retired, with a short reason. */
  retiredAt: integer('retired_at'),
  retiredReason: text('retired_reason'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const place = sqliteTable(
  'place',
  { ...memoryColumns(), name: text('name').notNull(), description: text('description') },
  (t) => [index('place_campaign_idx').on(t.campaignId)]
)

export const faction = sqliteTable(
  'faction',
  { ...memoryColumns(), name: text('name').notNull(), description: text('description') },
  (t) => [index('faction_campaign_idx').on(t.campaignId)]
)

export const event = sqliteTable(
  'event',
  { ...memoryColumns(), name: text('name').notNull(), description: text('description') },
  (t) => [index('event_campaign_idx').on(t.campaignId)]
)

export const npc = sqliteTable(
  'npc',
  {
    ...memoryColumns(),
    name: text('name').notNull(),
    description: text('description'),
    role: text('role'),
    status: text('status', { enum: NPC_STATUSES }).notNull().default('alive'),
    placeId: text('place_id').references(() => place.id, { onDelete: 'set null' })
  },
  (t) => [
    index('npc_campaign_idx').on(t.campaignId),
    check('npc_status_check', oneOf('status', NPC_STATUSES))
  ]
)

/** A fact is immutable; it changes only by being superseded or retired. */
export const fact = sqliteTable(
  'fact',
  {
    ...memoryColumns(),
    title: text('title').notNull(),
    detail: text('detail'),
    /** A change to the world itself, always kept in the DM's context. */
    worldChanging: integer('world_changing', { mode: 'boolean' }).notNull().default(false),
    supersededById: text('superseded_by_id').references((): AnySQLiteColumn => fact.id, {
      onDelete: 'set null'
    })
  },
  (t) => [index('fact_campaign_idx').on(t.campaignId)]
)

/** An NPC's stance toward one Character; keyed by Character so multi-Character Campaigns need no migration. */
export const disposition = sqliteTable(
  'disposition',
  {
    npcId: text('npc_id')
      .notNull()
      .references(() => npc.id, { onDelete: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'cascade' }),
    stance: text('stance', { enum: STANCES }).notNull(),
    note: text('note'),
    changedSessionId: text('changed_session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    changedSeq: integer('changed_seq').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.npcId, t.characterId] }),
    check('disposition_stance_check', oneOf('stance', STANCES))
  ]
)

/** What an NPC knows. World facts are never copied per Character. */
export const npcFact = sqliteTable(
  'npc_fact',
  {
    npcId: text('npc_id')
      .notNull()
      .references(() => npc.id, { onDelete: 'cascade' }),
    factId: text('fact_id')
      .notNull()
      .references(() => fact.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.npcId, t.factId] })]
)

/**
 * Where the player last looked at the Journal, per (Campaign, Character): a Session and a Turn
 * seq position. Records created or changed after it carry chips. Advances when the overlay closes.
 */
export const journalMarker = sqliteTable(
  'journal_marker',
  {
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'cascade' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.characterId] })]
)

export const ARC_STATUSES = ['draft', 'accepted'] as const
export const BEAT_STATES = ['pending', 'reached', 'abandoned'] as const

/**
 * A Campaign's Arc: at most one (unique `campaign_id`), no versions; regenerating replaces it.
 * Only an `accepted` Arc steers the DM.
 */
export const arc = sqliteTable(
  'arc',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: text('campaign_id')
      .notNull()
      .unique()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ARC_STATUSES }).notNull().default('draft'),
    title: text('title').notNull(),
    premise: text('premise').notNull(),
    stakes: text('stakes').notNull(),
    resolution: text('resolution').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  () => [check('arc_status_check', oneOf('status', ARC_STATUSES))]
)

/** An ordered phase of an Arc. `position` is 0-based and dense. */
export const arcAct = sqliteTable(
  'arc_act',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    arcId: text('arc_id')
      .notNull()
      .references(() => arc.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    purpose: text('purpose').notNull()
  },
  (t) => [index('arc_act_arc').on(t.arcId, t.position)]
)

/**
 * A turning point. The id is stable across edits so progress survives them. `state` leaves
 * `pending` once, and then the source Session and Turn seq are stamped.
 */
export const arcBeat = sqliteTable(
  'arc_beat',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actId: text('act_id')
      .notNull()
      .references(() => arcAct.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    state: text('state', { enum: BEAT_STATES }).notNull().default('pending'),
    sourceSessionId: text('source_session_id').references(() => session.id, {
      onDelete: 'set null'
    }),
    sourceTurnSeq: integer('source_turn_seq')
  },
  (t) => [
    index('arc_beat_act').on(t.actId, t.position),
    check('arc_beat_state_check', oneOf('state', BEAT_STATES))
  ]
)

export * from './rules-schema'
