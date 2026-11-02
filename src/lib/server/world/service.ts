import { and, asc, count, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '../db/connect'
import { GENRE_FLAVORS, MAGIC_LEVELS, SCALES, TECH_LEVELS } from '#lib/world/enums.ts'
import { world, worldCampaign } from '../db/schema'

export type World = typeof world.$inferSelect
export type WorldSeed = Omit<
  typeof world.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'archivedAt'
>

export class WorldValidationError extends Error {}

/** The World does not exist. */
export class WorldNotFoundError extends Error {}

/** Delete refused because a Campaign still references the World. */
export class WorldInUseError extends Error {}

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
  function setArchived(id: string, archivedAt: number | null): World {
    const current = db.select().from(world).where(eq(world.id, id)).get()
    if (!current) throw new WorldNotFoundError('World not found')
    // Already in the requested state: no-op, so archived_at/updated_at are not overwritten.
    if ((current.archivedAt === null) === (archivedAt === null)) return current
    return db
      .update(world)
      .set({ archivedAt, updatedAt: now() })
      .where(eq(world.id, id))
      .returning()
      .get()
  }

  function archivedWorldsOfCampaign(campaignId: string): World[] {
    return db
      .select({ world })
      .from(worldCampaign)
      .innerJoin(world, eq(world.id, worldCampaign.worldId))
      .where(and(eq(worldCampaign.campaignId, campaignId), isNotNull(world.archivedAt)))
      .orderBy(asc(world.name))
      .all()
      .map((r) => r.world)
  }

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
      if (db.select().from(world).where(eq(world.id, id)).get()) {
        throw new WorldValidationError('An archived World cannot be edited')
      }
      throw new WorldNotFoundError('World not found')
    },

    /** How many Campaigns an edit to this World touches. */
    affectedCampaignCount(id: string): number {
      return db
        .select({ n: count() })
        .from(worldCampaign)
        .where(eq(worldCampaign.worldId, id))
        .get()!.n
    },

    /** Hides the World from the list and picker and makes it read-only. */
    archive(id: string): World {
      return setArchived(id, now())
    },

    restore(id: string): World {
      return setArchived(id, null)
    },

    /** Hard delete; the database's RESTRICT refuses it while any Campaign references the World. */
    delete(id: string): void {
      try {
        const deleted = db.delete(world).where(eq(world.id, id)).returning().get()
        if (!deleted) throw new WorldNotFoundError('World not found')
      } catch (e) {
        // RESTRICT reports as SQLITE_CONSTRAINT_TRIGGER, other FK failures as _FOREIGNKEY.
        if (/^SQLITE_CONSTRAINT/.test((e as { code?: string }).code ?? '')) {
          throw new WorldInUseError('World is used by a Campaign; archive it instead')
        }
        throw e
      }
    },

    /** Derived, never stored: a Campaign is read-only while any linked World is archived. */
    isCampaignReadOnly(campaignId: string): boolean {
      return archivedWorldsOfCampaign(campaignId).length > 0
    },

    /** The archived Worlds blocking a Campaign, so the UI can name them. */
    archivedWorldsOfCampaign,

    /** Archived Worlds, most recently archived first. */
    listArchived(): World[] {
      return db
        .select()
        .from(world)
        .where(isNotNull(world.archivedAt))
        .orderBy(sql`${world.archivedAt} desc`, sql`rowid desc`)
        .all()
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
