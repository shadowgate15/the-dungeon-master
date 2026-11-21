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
import { LENGTHS, TONES } from '../../campaign/enums'
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
import {
  BEAT_STATES,
  MEMORY_RUN_KINDS,
  MEMORY_RUN_OUTCOMES,
  NPC_STATUSES,
  STANCES,
  type DroppedItem
} from '../../memory/enums'
import { GENRE_FLAVORS, MAGIC_LEVELS, SCALES, TECH_LEVELS } from '../../world/enums'
import { EVENT_KINDS, MODES, ROLES, type SceneExit } from '../../session/enums'
import type { Call } from '../../session/call'

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
 * A Campaign's linked Character. The app allows one Character per Campaign; the schema does not,
 * so a later multiplayer Campaign needs no migration.
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
 * allows at most one open Session per Campaign. It owns one Scene and an Event log.
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
    // Restrict: a Character that played is never deleted, since that would erase the Event log.
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'restrict' }),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    /** The last Event seq memory extraction covers; moves only when an extraction succeeds. */
    memoryThroughSeq: integer('memory_through_seq').notNull().default(0),
    /** The Rolling summary: prose over the Events up to `summaryThroughSeq`; null until one finishes. */
    summary: text('summary'),
    /** The last Event seq the Rolling summary covers; moves only when a summary call succeeds. */
    summaryThroughSeq: integer('summary_through_seq').notNull().default(0)
  },
  (t) => [
    uniqueIndex('session_one_open_per_campaign')
      .on(t.campaignId)
      .where(sql`ended_at IS NULL`)
  ]
)

/** A Session's Scene: where and how play stands now. One row per Session; only code writes it. */
export const sessionScene = sqliteTable(
  'session_scene',
  {
    sessionId: text('session_id')
      .primaryKey()
      .references(() => session.id, { onDelete: 'cascade' }),
    locationName: text('location_name').notNull(),
    locationDescription: text('location_description').notNull(),
    exits: text('exits', { mode: 'json' }).$type<SceneExit[]>().notNull(),
    objects: text('objects', { mode: 'json' }).$type<string[]>().notNull(),
    /** NPC row ids; name, attitude and knowledge resolve live from World memory. */
    npcs: text('npcs', { mode: 'json' }).$type<string[]>().notNull(),
    mode: text('mode', { enum: MODES }).notNull(),
    dialogueNpcId: text('dialogue_npc_id'),
    /** The Call the Exchange is waiting on (with its DC, never sent to the client). */
    openCall: text('open_call', { mode: 'json' }).$type<Call>(),
    updatedAt: integer('updated_at').notNull()
  },
  () => [check('session_scene_mode_check', oneOf('mode', MODES))]
)

/**
 * A Session's Event log, append-only: the service has no update or delete. `seq` is monotonic per
 * Session. Every event records the role that produced it.
 */
export const sessionEvent = sqliteTable(
  'session_event',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    role: text('role', { enum: ROLES }).notNull(),
    kind: text('kind', { enum: EVENT_KINDS }).notNull(),
    text: text('text'),
    npcId: text('npc_id'),
    data: text('data', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at').notNull()
  },
  (t) => [
    uniqueIndex('session_event_session_seq').on(t.sessionId, t.seq),
    check('session_event_role_check', oneOf('role', ROLES)),
    check('session_event_kind_check', oneOf('kind', EVENT_KINDS))
  ]
)

export const ARC_STATUSES = ['draft', 'accepted'] as const

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
 * A turning point. The id is stable across edits.
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
    // Beat state: leaves `pending` once. The stamps record the Session and the last Event id the
    // transition covered; all null while pending.
    state: text('state', { enum: BEAT_STATES }).notNull().default('pending'),
    stateSessionId: text('state_session_id').references(() => session.id, {
      onDelete: 'set null'
    }),
    stateEventId: text('state_event_id').references(() => sessionEvent.id, {
      onDelete: 'set null'
    }),
    stateChangedAt: integer('state_changed_at')
  },
  (t) => [
    index('arc_beat_act').on(t.actId, t.position),
    check('arc_beat_state_check', oneOf('state', BEAT_STATES))
  ]
)

// World memory. Every record is Campaign-scoped and cascades with its Campaign. Provenance: the
// Session and Event seq a record was created and last changed in; seq is null only for first-Session
// seeding. Records are retired (a timestamp and a reason), never deleted. See GLOSSARY.md.
const campaignRef = () =>
  text('campaign_id')
    .notNull()
    .references(() => campaign.id, { onDelete: 'cascade' })
const sessionRef = (name: string) =>
  text(name)
    .notNull()
    .references(() => session.id, { onDelete: 'cascade' })
const provenance = () => ({
  createdSessionId: sessionRef('created_session_id'),
  createdSeq: integer('created_seq'),
  changedSessionId: sessionRef('changed_session_id'),
  changedSeq: integer('changed_seq')
})
const retirement = () => ({
  retiredAt: integer('retired_at'),
  retiredReason: text('retired_reason')
})
const retiredCheck = (table: string) =>
  check(`${table}_retired_check`, sql.raw('(retired_at IS NULL) = (retired_reason IS NULL)'))

/** A location the story established, hosted by one of the Campaign's Worlds. */
export const place = sqliteTable(
  'place',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: campaignRef(),
    worldId: text('world_id')
      .notNull()
      .references(() => world.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    ...provenance(),
    ...retirement()
  },
  (t) => [index('place_campaign').on(t.campaignId), retiredCheck('place')]
)

/**
 * An exit, an edge owned by its place. `targetPlaceId` is null until the exit is first used, then
 * fixed, so going back through it leads to the same place.
 */
export const placeExit = sqliteTable(
  'place_exit',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    placeId: text('place_id')
      .notNull()
      .references(() => place.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    targetPlaceId: text('target_place_id').references(() => place.id, { onDelete: 'set null' })
  },
  (t) => [uniqueIndex('place_exit_place_name').on(t.placeId, t.name)]
)

/**
 * An NPC. `nameKey` is the normalized name, unique per Campaign. `status` and retirement are
 * separate: a dead NPC is not retired. `placeId` is where code last placed them.
 */
export const npc = sqliteTable(
  'npc',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: campaignRef(),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    description: text('description').notNull(),
    role: text('role').notNull(),
    status: text('status', { enum: NPC_STATUSES }).notNull().default('alive'),
    placeId: text('place_id').references(() => place.id, { onDelete: 'set null' }),
    ...provenance(),
    ...retirement()
  },
  (t) => [
    uniqueIndex('npc_campaign_name_key').on(t.campaignId, t.nameKey),
    check('npc_status_check', oneOf('status', NPC_STATUSES)),
    retiredCheck('npc')
  ]
)

/** NPC memory: how an NPC regards a Character. Knowledge is `npcFact` links, never copied text. */
export const disposition = sqliteTable(
  'disposition',
  {
    npcId: text('npc_id')
      .notNull()
      .references(() => npc.id, { onDelete: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'cascade' }),
    stance: text('stance', { enum: STANCES }).notNull().default('neutral'),
    note: text('note').notNull().default(''),
    changedSessionId: sessionRef('changed_session_id'),
    changedSeq: integer('changed_seq')
  },
  (t) => [
    primaryKey({ columns: [t.npcId, t.characterId] }),
    check('disposition_stance_check', oneOf('stance', STANCES))
  ]
)

/**
 * A claim the story established. Immutable: it changes only by being superseded (`supersededById`)
 * or retired; a trigger rejects edits to its text or flag.
 */
export const fact = sqliteTable(
  'fact',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: campaignRef(),
    title: text('title').notNull(),
    detail: text('detail').notNull(),
    worldChanging: integer('world_changing', { mode: 'boolean' }).notNull().default(false),
    supersededById: text('superseded_by_id').references((): AnySQLiteColumn => fact.id, {
      onDelete: 'set null'
    }),
    ...provenance(),
    ...retirement()
  },
  (t) => [index('fact_campaign').on(t.campaignId), retiredCheck('fact')]
)

/** What an NPC knows: a link to a fact, never a copy of its text. */
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
 * One row per memory extraction or summary attempt, append-only and never pruned. Records counts
 * and why items were dropped (`{kind, reason}`, never item text).
 */
export const memoryRun = sqliteTable(
  'memory_run',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: MEMORY_RUN_KINDS }).notNull(),
    fromSeq: integer('from_seq').notNull(),
    toSeq: integer('to_seq').notNull(),
    outcome: text('outcome', { enum: MEMORY_RUN_OUTCOMES }).notNull(),
    accepted: integer('accepted').notNull().default(0),
    dropped: integer('dropped').notNull().default(0),
    droppedItems: text('dropped_items', { mode: 'json' })
      .$type<DroppedItem[]>()
      .notNull()
      .default(sql`'[]'`),
    durationMs: integer('duration_ms').notNull(),
    createdAt: integer('created_at').notNull()
  },
  (t) => [
    index('memory_run_session').on(t.sessionId, t.createdAt),
    check('memory_run_kind_check', oneOf('kind', MEMORY_RUN_KINDS)),
    check('memory_run_outcome_check', oneOf('outcome', MEMORY_RUN_OUTCOMES))
  ]
)

export * from './rules-schema'
