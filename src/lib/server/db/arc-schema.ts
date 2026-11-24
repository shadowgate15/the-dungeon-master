import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const ARC_STATES = ['current', 'concluded', 'retired'] as const
export type ArcState = (typeof ARC_STATES)[number]

export const BEAT_STATES = ['pending', 'reached', 'abandoned'] as const
export type BeatState = (typeof BEAT_STATES)[number]

/**
 * The Arc: the DM's hidden plan for the story. At most one is current; it leaves current once
 * (concluded or retired) and stays on record. The whole Arc carries one `version`. Nothing here
 * ever reaches the Player.
 */
export const arc = sqliteTable(
  'arc',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    premise: text('premise').notNull(),
    stakes: text('stakes').notNull(),
    resolution: text('resolution').notNull(),
    state: text('state', { enum: ARC_STATES }).notNull().default('current'),
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at').notNull(),
    /** When it left current (concluded or retired). */
    endedAt: integer('ended_at'),
    endReason: text('end_reason')
  },
  (t) => [
    check('arc_state', sql`${t.state} IN ('current', 'concluded', 'retired')`),
    uniqueIndex('arc_one_current')
      .on(t.state)
      .where(sql`${t.state} = 'current'`)
  ]
)

/** One Act of an Arc, in order: a name and what it is for. */
export const act = sqliteTable('act', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  arcId: text('arc_id')
    .notNull()
    .references(() => arc.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  name: text('name').notNull(),
  purpose: text('purpose').notNull()
})

/** One Beat of an Act, in order, with a readable handle (`beat:the-vizier-is-the-patron`). */
export const beat = sqliteTable(
  'beat',
  {
    handle: text('handle').primaryKey(),
    actId: integer('act_id')
      .notNull()
      .references(() => act.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    state: text('state', { enum: BEAT_STATES }).notNull().default('pending'),
    /** Why it was reached or abandoned. */
    reason: text('reason'),
    resolvedAt: integer('resolved_at')
  },
  (t) => [check('beat_state', sql`${t.state} IN ('pending', 'reached', 'abandoned')`)]
)
