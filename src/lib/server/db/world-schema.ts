import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { ENTITY_TYPES } from '../../world/entity-types'

/*
 * The World layer: the DM-only truth (ADR 0007). Typed rows, one Page per Entity with every
 * revision kept, and append-only bi-temporal Facts. `[[links]]` are stored as handles.
 * Full-text search lives in the `world_search` FTS5 table, created in the migration by hand.
 */

/**
 * An NPC, Place, Faction or Topic. `handle` is its readable, code-generated id (`npc:mira-voss`).
 * `fields` holds the typed fields, checked against the type's schema in code.
 */
export const entity = sqliteTable(
  'entity',
  {
    handle: text('handle').primaryKey(),
    type: text('type', { enum: ENTITY_TYPES }).notNull(),
    name: text('name').notNull(),
    fields: text('fields', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    version: integer('version').notNull().default(1),
    retiredAt: integer('retired_at'),
    retiredReason: text('retired_reason'),
    /** Set when the Entity was retired by merging it into another. */
    mergedInto: text('merged_into'),
    createdAt: integer('created_at').notNull()
  },
  () => [
    check('entity_type_check', sql.raw(`type IN (${ENTITY_TYPES.map((t) => `'${t}'`).join(', ')})`))
  ]
)

/** Other names an Entity goes by. */
export const entityAlias = sqliteTable(
  'entity_alias',
  {
    handle: text('handle')
      .notNull()
      .references(() => entity.handle),
    alias: text('alias').notNull()
  },
  (t) => [primaryKey({ columns: [t.handle, t.alias] })]
)

/** Every revision of every Page; the newest is the Page. Links are stored as `[[handle]]`. */
export const pageRevision = sqliteTable(
  'page_revision',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    handle: text('handle')
      .notNull()
      .references(() => entity.handle),
    text: text('text').notNull(),
    sessionId: text('session_id'),
    eventId: integer('event_id'),
    createdAt: integer('created_at').notNull()
  },
  (t) => [index('page_revision_handle_idx').on(t.handle)]
)

/**
 * A Fact: append-only and bi-temporal. `validFrom` null means since before the Campaign. A Fact is
 * current until superseded (`supersededBy`, closed at `validTo`) or retired (with a reason).
 */
export const fact = sqliteTable(
  'fact',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    subject: text('subject')
      .notNull()
      .references(() => entity.handle),
    claim: text('claim').notNull(),
    validFrom: integer('valid_from'),
    validTo: integer('valid_to'),
    supersededBy: integer('superseded_by'),
    retiredAt: integer('retired_at'),
    retiredReason: text('retired_reason'),
    sessionId: text('session_id'),
    eventId: integer('event_id'),
    recordedMinute: integer('recorded_minute').notNull()
  },
  (t) => [index('fact_subject_idx').on(t.subject)]
)

/** An indexed `[[link]]`: from an Entity's Page (`factId` null) or from one of its Facts. */
export const worldLink = sqliteTable(
  'world_link',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fromHandle: text('from_handle').notNull(),
    factId: integer('fact_id'),
    toHandle: text('to_handle').notNull()
  },
  (t) => [index('world_link_from_idx').on(t.fromHandle), index('world_link_to_idx').on(t.toHandle)]
)
