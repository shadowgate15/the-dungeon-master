import { asc, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../db/connect'
import { world } from '../db/schema'

export type World = typeof world.$inferSelect
export type WorldSeed = Omit<
  typeof world.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt'
>

export class WorldValidationError extends Error {}

export function createWorldService(db: Database, now: () => number = Date.now) {
  return {
    create(seed: WorldSeed): World {
      const name = seed.name?.trim()
      if (!name) throw new WorldValidationError('Name is required')
      const at = now()
      return db
        .insert(world)
        .values({ ...seed, name, createdAt: at, updatedAt: at })
        .returning()
        .get()
    },

    get(id: string): World | undefined {
      return db.select().from(world).where(eq(world.id, id)).get()
    },

    /** Active Worlds only, oldest first. */
    list(): World[] {
      return db
        .select()
        .from(world)
        .where(isNull(world.archivedAt))
        .orderBy(asc(world.createdAt), asc(sql`rowid`))
        .all()
    }
  }
}

export type WorldService = ReturnType<typeof createWorldService>
