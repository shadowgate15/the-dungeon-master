import { and, asc, count, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../db/connect'
import { GENRE_FLAVORS, MAGIC_LEVELS, SCALES, TECH_LEVELS } from '#lib/world/enums.ts'
import { world, worldCampaign } from '../db/schema'

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

function validate(seed: WorldSeed) {
  const name = seed.name?.trim()
  if (!name) throw new WorldValidationError('Name is required')
  return {
    name,
    premise: seed.premise?.trim() || null,
    genreFlavor: checkEnum('genre flavor', GENRE_FLAVORS, seed.genreFlavor),
    scale: checkEnum('scale', SCALES, seed.scale),
    magicLevel: checkEnum('magic level', MAGIC_LEVELS, seed.magicLevel),
    techLevel: checkEnum('tech level', TECH_LEVELS, seed.techLevel)
  }
}

export function createWorldService(db: Database, now: () => number = Date.now) {
  return {
    create(seed: WorldSeed): World {
      const at = now()
      return db
        .insert(world)
        .values({ ...validate(seed), createdAt: at, updatedAt: at })
        .returning()
        .get()
    },

    /** Edits apply live to every Campaign using the World; updated_at always moves. */
    update(id: string, seed: WorldSeed): World {
      const values = validate(seed)
      const updated = db
        .update(world)
        .set({ ...values, updatedAt: now() })
        .where(and(eq(world.id, id), isNull(world.archivedAt)))
        .returning()
        .get()
      if (updated) return updated
      throw new WorldValidationError(
        db.select().from(world).where(eq(world.id, id)).get()
          ? 'An archived World cannot be edited'
          : 'World not found'
      )
    },

    /** How many Campaigns an edit to this World touches. */
    affectedCampaignCount(id: string): number {
      return db
        .select({ n: count() })
        .from(worldCampaign)
        .where(eq(worldCampaign.worldId, id))
        .get()!.n
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
