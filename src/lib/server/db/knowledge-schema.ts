import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { character } from './schema'

/** What a Belief points at: a Fact, an Entity's existence, a field's value, or its own claim. */
export const BELIEF_KINDS = ['fact', 'entity', 'field', 'claim'] as const
export type BeliefKind = (typeof BELIEF_KINDS)[number]

/**
 * The Knowledge layer (ADR 0007): what each Holder believes. A Holder is a Character
 * (`holderCharacter`) or an NPC (`holderNpc`), never both. Outdatedness is computed against the
 * live World on read, never stored. A replaced Belief stays as history (`replacedBy`).
 */
export const belief = sqliteTable(
  'belief',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    holderCharacter: text('holder_character').references(() => character.id, {
      onDelete: 'cascade'
    }),
    holderNpc: text('holder_npc'),
    kind: text('kind', { enum: BELIEF_KINDS }).notNull(),
    /** The Fact, for `fact` Beliefs. */
    factId: integer('fact_id'),
    /** The Entity the Belief is about: the Fact's subject, the Entity, the field's owner, or `about`. */
    about: text('about'),
    field: text('field'),
    /** The field's value as learned, for `field` Beliefs. */
    value: text('value', { mode: 'json' }).$type<unknown>(),
    /** A lie or rumour's own claim, with `[[links]]` stored as handles. */
    claim: text('claim'),
    /** What the Holder believes, rendered when learned: the text the Holder keeps. */
    text: text('text').notNull(),
    /** The name of what it is about, as the Holder learned it. */
    aboutName: text('about_name'),
    source: text('source'),
    sessionId: text('session_id'),
    eventId: integer('event_id'),
    learnedMinute: integer('learned_minute').notNull(),
    replacedBy: integer('replaced_by'),
    retiredAt: integer('retired_at'),
    retiredReason: text('retired_reason')
  },
  (t) => [
    index('belief_holder_character_idx').on(t.holderCharacter),
    index('belief_holder_npc_idx').on(t.holderNpc),
    index('belief_about_idx').on(t.about),
    check(
      'belief_one_holder_check',
      sql`(${t.holderCharacter} IS NULL) <> (${t.holderNpc} IS NULL)`
    ),
    check('belief_kind_check', sql.raw(`kind IN (${BELIEF_KINDS.map((k) => `'${k}'`).join(', ')})`))
  ]
)
