import { asc, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../db/connect'
import { GENRE_FLAVORS, MAGIC_LEVELS, SCALES, TECH_LEVELS } from '#lib/world/enums.ts'
import { world } from '../db/schema'

export type World = typeof world.$inferSelect
export type WorldSeed = Omit<
  typeof world.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt'
>

export class WorldValidationError extends Error {}

function checkEnum<T extends string>(
  label: string,
  values: readonly T[],
  value: string | null | undefined
): T | null {
  if (value == null) return null
  if (!(values as readonly string[]).includes(value)) {
    throw new WorldValidationError(`Invalid ${label}: ${value}`)
  }
  return value as T
}

export function createWorldService(db: Database, now: () => number = Date.now) {
  return {
    create(seed: WorldSeed): World {
      const name = seed.name?.trim()
      if (!name) throw new WorldValidationError('Name is required')
      const values = {
        name,
        premise: seed.premise?.trim() || null,
        genreFlavor: checkEnum('genre flavor', GENRE_FLAVORS, seed.genreFlavor),
        scale: checkEnum('scale', SCALES, seed.scale),
        magicLevel: checkEnum('magic level', MAGIC_LEVELS, seed.magicLevel),
        techLevel: checkEnum('tech level', TECH_LEVELS, seed.techLevel)
      }
      const at = now()
      return db
        .insert(world)
        .values({ ...values, createdAt: at, updatedAt: at })
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
