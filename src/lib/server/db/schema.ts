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
import {
  GENRE_FLAVORS,
  LENGTHS,
  MAGIC_LEVELS,
  SCALES,
  TECH_LEVELS,
  TONES
} from '../../campaign/enums'
import { ABILITY_KEYS } from '../../rules/registry'
import {
  ABILITY_METHODS,
  ALIGNMENTS,
  CHARACTER_STATUSES,
  PICK_SOURCES
} from '../../character/enums'
import type { StepId } from '../../character/steps'
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

// NULL in an enum column means "unspecified". No user or auth columns yet.
const oneOf = (column: string, values: readonly string[]) =>
  sql.raw(`${column} IS NULL OR ${column} IN (${values.map((v) => `'${v}'`).join(', ')})`)

/**
 * The Campaign this database belongs to: one row, in the `.dm/campaign.db` of its Campaign
 * folder. It holds the Campaign Seed. Only the name is required to exist; the Seed is complete
 * once premise, tone and length are set too (see `#lib/campaign/seed.ts`).
 */
export const campaign = sqliteTable(
  'campaign',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    premise: text('premise'),
    tone: text('tone', { enum: TONES }),
    length: text('length', { enum: LENGTHS }),
    worldName: text('world_name'),
    genreFlavor: text('genre_flavor', { enum: GENRE_FLAVORS }),
    scale: text('scale', { enum: SCALES }),
    magicLevel: text('magic_level', { enum: MAGIC_LEVELS }),
    techLevel: text('tech_level', { enum: TECH_LEVELS }),
    /** The Seed's Entity version: every write to the Seed passes it and bumps it. */
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    archivedAt: integer('archived_at'),
    /** When the open turn started waiting on the DM (a closed Floor); null when nothing awaits Narration. */
    awaitingNarrationSince: integer('awaiting_narration_since'),
    /** The Seed fields the DM set last ("✎ DM" on the card); a Player edit of a field drops it. */
    dmSeedFields: text('dm_seed_fields', { mode: 'json' }).$type<string[]>().notNull().default([]),
    /** When the Player pressed Begin (#335); null while the Campaign is still being created. */
    begunAt: integer('begun_at'),
    /** The last Event the DM has heard about: change notices cover the Player's edits after it. */
    noticedThrough: integer('noticed_through').notNull().default(0),
    /** The Campaign clock: in-fiction minutes since the Campaign started. Never moves backwards. */
    clockMinute: integer('clock_minute').notNull().default(0),
    /** The Scene: the handle of the Place the spotlight is on, or null before it is first set. */
    scene: text('scene')
  },
  () => [
    check('campaign_tone_check', oneOf('tone', TONES)),
    check('campaign_length_check', oneOf('length', LENGTHS)),
    check('campaign_genre_flavor_check', oneOf('genre_flavor', GENRE_FLAVORS)),
    check('campaign_scale_check', oneOf('scale', SCALES)),
    check('campaign_magic_level_check', oneOf('magic_level', MAGIC_LEVELS)),
    check('campaign_tech_level_check', oneOf('tech_level', TECH_LEVELS))
  ]
)

/**
 * The Event log: append-only, one event per mutating game-tool call, written in the call's
 * transaction. The Session and in-fiction minute are stamped by code, never taken from input.
 * Corrections are new events.
 */
export const event = sqliteTable('event', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** The Session the event belongs to; null for offline edits (no Session yet). */
  sessionId: text('session_id'),
  /** In-fiction minutes since the Campaign started. */
  minute: integer('minute').notNull(),
  /** The game tool that logged it. */
  tool: text('tool').notNull(),
  kind: text('kind').notNull(),
  summary: text('summary').notNull(),
  data: text('data', { mode: 'json' }).$type<Record<string, unknown>>(),
  /** DM-only events (Arc and Beat changes) never reach the Player. */
  dmOnly: integer('dm_only', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull()
})

const ref = (name: string, target: () => AnySQLiteColumn) =>
  integer(name).notNull().references(target, { onDelete: 'restrict' })
const optionalRef = (name: string, target: () => AnySQLiteColumn) =>
  integer(name).references(target, { onDelete: 'restrict' })
const between = (column: string, min: number, max: number) =>
  sql.raw(`${column} BETWEEN ${min} AND ${max}`)

const campaignOwner = () =>
  text('campaign_id')
    .notNull()
    .references(() => campaign.id, { onDelete: 'cascade' })

/** Coin by denomination. */
export type Coin = { cp: number; sp: number; ep: number; gp: number; pp: number }

/**
 * A Player's hero in one Campaign: the Player's choices plus play state. Everything computed from
 * the choices (max HP, AC, modifiers, slots) is derived and never stored. Rules references are
 * integer FKs (RESTRICT). Nothing references a Character except its own child rows, which cascade
 * on delete.
 */
export const character = sqliteTable(
  'character',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: campaignOwner(),
    /** The Player who controls this Character; exactly one, transferable. */
    controllingPlayer: text('controlling_player').notNull(),
    status: text('status', { enum: CHARACTER_STATUSES }).notNull().default('alive'),
    /** The Character's Entity version: bumped by every edit, named in change notices. */
    version: integer('version').notNull().default(1),
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
    // Play state: current values only; history is the Event log.
    currentHp: integer('current_hp').notNull(),
    tempHp: integer('temp_hp').notNull().default(0),
    /** Spent spell slots by slot level 1 to 9. */
    spentSlots: text('spent_slots', { mode: 'json' })
      .$type<number[]>()
      .notNull()
      .$defaultFn(() => [0, 0, 0, 0, 0, 0, 0, 0, 0]),
    hitDiceSpent: integer('hit_dice_spent').notNull().default(0),
    /** Spent uses by feature slug. */
    featureUses: text('feature_uses', { mode: 'json' })
      .$type<Record<string, number>>()
      .notNull()
      .$defaultFn(() => ({})),
    /** Condition slugs. */
    conditions: text('conditions', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    coin: text('coin', { mode: 'json' })
      .$type<Coin>()
      .notNull()
      .$defaultFn(() => ({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 })),
    /** The spell slug being concentrated on. */
    concentration: text('concentration'),
    deathSaves: text('death_saves', { mode: 'json' })
      .$type<{ successes: number; failures: number }>()
      .notNull()
      .$defaultFn(() => ({ successes: 0, failures: 0 })),
    /** Where the Character is; presence in a Scene is computed from it. */
    whereabouts: text('whereabouts'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  () => [
    check('character_level_check', between('level', 1, 20)),
    check('character_status_check', oneOf('status', CHARACTER_STATUSES)),
    check('character_temp_hp_check', sql.raw('temp_hp >= 0')),
    check('character_hit_dice_spent_check', sql.raw('hit_dice_spent >= 0')),
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

/** What the Character carries: item and count. Starts as the starting equipment on save. */
export const characterItem = sqliteTable(
  'character_item',
  {
    characterId: owner(),
    itemId: ref('item_id', () => equipment.id),
    quantity: integer('quantity').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.itemId] }),
    check('character_item_quantity_check', sql.raw('quantity >= 1'))
  ]
)

/**
 * A Character draft: the unsaved state of a new Character while the wizard is open, stored with
 * the Campaign so a reload loses nothing. `data` is the wizard's draft as is; it joins the Party
 * only when saved, which turns it into a `character` row and removes the draft.
 */
export const characterDraft = sqliteTable('character_draft', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  campaignId: campaignOwner(),
  controllingPlayer: text('controlling_player').notNull(),
  data: text('data', { mode: 'json' }).$type<unknown>().notNull(),
  /** The wizard step the draft was last on. */
  step: text('step').$type<StepId>().notNull(),
  /** The draft's Entity version: bumped by every write that changes it, from the wizard or the DM. */
  version: integer('version').notNull().default(1),
  /** The draft fields the DM set last ("✎ DM" in the wizard); a Player edit of a field drops it. */
  dmFields: text('dm_fields', { mode: 'json' }).$type<string[]>().notNull().default([]),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

/**
 * The creation conversation in the DM pane: the Player's messages, the DM's replies and muted lines
 * for the DM's field writes. Out of fiction, so it is never part of the Event log.
 */
export const conversationMessage = sqliteTable('conversation_message', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  author: text('author', { enum: ['player', 'dm', 'dm_write'] }).notNull(),
  /** The Player who wrote it; null for the DM's lines. */
  player: text('player'),
  text: text('text').notNull(),
  createdAt: integer('created_at').notNull()
})

/**
 * A Floor: the DM waiting on the Players' Declarations. At most one is open per Campaign; until it
 * closes its Declarations can be added, edited or withdrawn and the DM hears none of them.
 */
export const floor = sqliteTable('floor', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  campaignId: campaignOwner(),
  state: text('state', { enum: ['open', 'closed'] })
    .notNull()
    .default('open'),
  /** The Players who have pressed Done on it; it closes once every Player at the table has. */
  done: text('done', { mode: 'json' }).$type<string[]>().notNull().default([]),
  createdAt: integer('created_at').notNull(),
  closedAt: integer('closed_at')
})

/**
 * A Declaration on a Floor: what a Player says one Character does. It names exactly one Character
 * and the Player who declared it. Withdrawing one deletes it; the DM never heard it.
 */
export const declaration = sqliteTable(
  'declaration',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    floorId: text('floor_id')
      .notNull()
      .references(() => floor.id, { onDelete: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'cascade' }),
    player: text('player').notNull(),
    text: text('text').notNull(),
    /** Send order on its Floor. */
    position: integer('position').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [index('declaration_floor_idx').on(t.floorId)]
)

/**
 * A Session: one sitting, begun when a DM attaches. At most one is open. Summary and threads are
 * written when it closes.
 */
export const session = sqliteTable('session', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  number: integer('number').notNull().unique(),
  /** The bridge (one per Claude Code session) whose attach opened it; a reconnect reuses it. */
  bridge: text('bridge'),
  startedAt: integer('started_at').notNull(),
  closedAt: integer('closed_at'),
  summary: text('summary'),
  threads: text('threads', { mode: 'json' }).$type<string[]>()
})

/**
 * A Player-safe `⚙ DM …` line in the timeline: what the DM did with one tool call, written by the
 * server from the call (never the raw result). It sits after the Event `afterEvent` in the timeline.
 */
export const activityLine = sqliteTable('activity_line', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id'),
  afterEvent: integer('after_event').notNull(),
  text: text('text').notNull(),
  createdAt: integer('created_at').notNull()
})

/**
 * A Call: the DM's open request to the Players, a Check to roll or a question to answer. At most
 * one is open per Campaign; it is kept with the Scene until every part is answered or a closed
 * Floor with Declarations withdraws it. `pending` (an action tool's Call not yet attached by
 * `narrate`) and `cancelled` are for the action tools.
 */
export const call = sqliteTable('call', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  campaignId: campaignOwner(),
  kind: text('kind', { enum: ['check', 'question'] }).notNull(),
  state: text('state', { enum: ['pending', 'open', 'answered', 'withdrawn', 'cancelled'] })
    .notNull()
    .default('open'),
  /** A question's text; null for a Check. */
  text: text('text'),
  /** A question's choices; empty for free text (and for a Check). */
  choices: text('choices', { mode: 'json' }).$type<string[]>().notNull().default([]),
  /** The Event (a Narration) that opened it. */
  openedBy: integer('opened_by'),
  createdAt: integer('created_at').notNull(),
  closedAt: integer('closed_at')
})

/** One roll of a Check, after the dice: both d20s on advantage, the one kept and the total. */
export type CheckResult = {
  dice: number[]
  kept: number
  modifier: number
  total: number
  success: boolean
}

/**
 * One part of a Call, addressed to one Player: a Check for one Character (its skill or save, the
 * hidden DC from the tier), or a question's answer. It holds the result once answered.
 */
export const callPart = sqliteTable(
  'call_part',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    callId: text('call_id')
      .notNull()
      .references(() => call.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    /** The Character rolling; null for a question, which goes to the Player. */
    characterId: text('character_id').references(() => character.id, { onDelete: 'cascade' }),
    /** The Controlling Player the part is addressed to. */
    player: text('player').notNull(),
    /** Skill slug, for a skill Check. */
    skill: text('skill'),
    /** Ability key, for a saving throw. */
    save: text('save', { enum: ABILITY_KEYS }),
    tier: text('tier'),
    /** The DM-only DC; never in a Player payload. */
    dc: integer('dc'),
    mode: text('mode', { enum: ['normal', 'advantage', 'disadvantage'] })
      .notNull()
      .default('normal'),
    reason: text('reason'),
    result: text('result', { mode: 'json' }).$type<CheckResult>(),
    answer: text('answer'),
    answeredAt: integer('answered_at')
  },
  (t) => [index('call_part_call_idx').on(t.callId)]
)

/**
 * A Declaration sent back to its Player's composer as unsent text: its Character left the Scene
 * when the spotlight cut away before the Floor closed. The console loads it, then clears it.
 */
export const returnedDraft = sqliteTable('returned_draft', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  characterId: text('character_id')
    .notNull()
    .references(() => character.id, { onDelete: 'cascade' }),
  player: text('player').notNull(),
  text: text('text').notNull(),
  createdAt: integer('created_at').notNull()
})

export * from './rules-schema'
export * from './world-schema'
export * from './knowledge-schema'
export * from './arc-schema'
