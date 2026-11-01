import { sql } from 'drizzle-orm'
import { check, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
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

// Stub: the Campaign map owns this table afterwards.
export const campaign = sqliteTable('campaign', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())
})

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
