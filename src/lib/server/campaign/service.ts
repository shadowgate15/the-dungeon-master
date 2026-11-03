import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '../db/connect'
import { campaign, world, worldCampaign } from '../db/schema'
import { createWorldService, type World } from '../world/service'
import { LENGTHS, PREMISE_SERVICE_MAX, TONES } from '#lib/campaign/enums.ts'
import { NAME_MAX } from '#lib/world/seed.ts'

export type Campaign = typeof campaign.$inferSelect
export type CampaignWithWorlds = Campaign & { worlds: World[] }
export type CampaignSeed = Pick<
  typeof campaign.$inferInsert,
  'name' | 'premise' | 'tone' | 'length'
>

/** The input breaks a Campaign rule (blank or over-long text, bad enum, bad World set, not editable). */
export class CampaignValidationError extends Error {}

/** The Campaign does not exist. */
export class CampaignNotFoundError extends Error {}

function checkEnum<T extends string>(label: string, values: readonly T[], value: unknown): T {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    throw new CampaignValidationError(`Invalid ${label}: ${String(value)}`)
  }
  return value as T
}

function validate(seed: CampaignSeed) {
  const name = seed.name?.trim()
  if (!name) throw new CampaignValidationError('Name is required')
  if (name.length > NAME_MAX) {
    throw new CampaignValidationError(`Name must be at most ${NAME_MAX} characters`)
  }
  const premise = seed.premise?.trim()
  if (!premise) throw new CampaignValidationError('Premise is required')
  if (premise.length > PREMISE_SERVICE_MAX) {
    throw new CampaignValidationError(`Premise must be at most ${PREMISE_SERVICE_MAX} characters`)
  }
  return {
    name,
    premise,
    tone: checkEnum('tone', TONES, seed.tone),
    length: checkEnum('length', LENGTHS, seed.length)
  }
}

export function createCampaignService(db: Database, now: () => number = Date.now) {
  const worlds = createWorldService(db, now)

  function linkedWorlds(campaignId: string): World[] {
    return db
      .select({ world })
      .from(worldCampaign)
      .innerJoin(world, eq(world.id, worldCampaign.worldId))
      .where(eq(worldCampaign.campaignId, campaignId))
      .orderBy(asc(world.name), asc(world.id))
      .all()
      .map((r) => r.world)
  }

  /** Dedupes and requires a non-empty set of existing, active Worlds. */
  function checkWorldIds(worldIds: readonly string[]): string[] {
    const ids = [...new Set(worldIds)]
    if (ids.length === 0) throw new CampaignValidationError('A Campaign needs at least one World')
    const active = db
      .select({ id: world.id })
      .from(world)
      .where(and(inArray(world.id, ids), isNull(world.archivedAt)))
      .all()
      .map((r) => r.id)
    const bad = ids.filter((id) => !active.includes(id))
    if (bad.length > 0) {
      throw new CampaignValidationError('Worlds must exist and not be archived')
    }
    return ids
  }

  function setArchived(id: string, archivedAt: number | null): Campaign {
    const current = db.select().from(campaign).where(eq(campaign.id, id)).get()
    if (!current) throw new CampaignNotFoundError('Campaign not found')
    // Already in the requested state: no-op, so archived_at/updated_at are not overwritten.
    if ((current.archivedAt === null) === (archivedAt === null)) return current
    return db
      .update(campaign)
      .set({ archivedAt, updatedAt: now() })
      .where(eq(campaign.id, id))
      .returning()
      .get()
  }

  return {
    /** Inserts the Campaign and its World links atomically. */
    create(seed: CampaignSeed, worldIds: readonly string[]): Campaign {
      const values = validate(seed)
      return db.transaction((tx) => {
        const ids = checkWorldIds(worldIds)
        const at = now()
        const created = tx
          .insert(campaign)
          .values({ ...values, createdAt: at, updatedAt: at })
          .returning()
          .get()
        tx.insert(worldCampaign)
          .values(ids.map((worldId) => ({ worldId, campaignId: created.id })))
          .run()
        return created
      })
    },

    /** Replaces the Seed fields and the whole World set in one transaction; updated_at always moves. */
    update(id: string, seed: CampaignSeed, worldIds: readonly string[]): Campaign {
      const values = validate(seed)
      return db.transaction((tx) => {
        const current = tx.select().from(campaign).where(eq(campaign.id, id)).get()
        if (!current) throw new CampaignNotFoundError('Campaign not found')
        if (current.archivedAt !== null) {
          throw new CampaignValidationError('An archived Campaign cannot be edited')
        }
        const blocking = worlds.archivedWorldsOfCampaign(id)
        if (blocking.length > 0) {
          throw new CampaignValidationError(
            `Campaign is read-only while these Worlds are archived: ${blocking.map((w) => w.name).join(', ')}`
          )
        }
        const ids = checkWorldIds(worldIds)
        const updated = tx
          .update(campaign)
          .set({ ...values, updatedAt: now() })
          .where(eq(campaign.id, id))
          .returning()
          .get()
        tx.delete(worldCampaign).where(eq(worldCampaign.campaignId, id)).run()
        tx.insert(worldCampaign)
          .values(ids.map((worldId) => ({ worldId, campaignId: id })))
          .run()
        return updated
      })
    },

    /** Always allowed, including while read-only; a no-op when already archived. */
    archive(id: string): Campaign {
      return setArchived(id, now())
    },

    /** Always allowed, including while a World is archived; a no-op when already active. */
    restore(id: string): Campaign {
      return setArchived(id, null)
    },

    /** Hard delete; links cascade and Worlds are untouched. */
    delete(id: string): void {
      const deleted = db.delete(campaign).where(eq(campaign.id, id)).returning().get()
      if (!deleted) throw new CampaignNotFoundError('Campaign not found')
    },

    /** The archived Worlds that make a Campaign read-only, so the UI can name them. */
    blockingWorlds(id: string): World[] {
      return worlds.archivedWorldsOfCampaign(id)
    },

    isReadOnly(id: string): boolean {
      return worlds.isCampaignReadOnly(id)
    },

    get(id: string): CampaignWithWorlds | undefined {
      const found = db.select().from(campaign).where(eq(campaign.id, id)).get()
      return found && { ...found, worlds: linkedWorlds(id) }
    },

    /** Active Campaigns, oldest first, optionally only those set in one World. */
    list(filter: { worldId?: string } = {}): Campaign[] {
      const active = isNull(campaign.archivedAt)
      const where = filter.worldId
        ? and(
            active,
            inArray(
              campaign.id,
              db
                .select({ id: worldCampaign.campaignId })
                .from(worldCampaign)
                .where(eq(worldCampaign.worldId, filter.worldId))
            )
          )
        : active
      return db
        .select()
        .from(campaign)
        .where(where)
        .orderBy(asc(campaign.createdAt), asc(sql`rowid`))
        .all()
    },

    /** Archived Campaigns, most recently archived first. */
    listArchived(): Campaign[] {
      return db
        .select()
        .from(campaign)
        .where(isNotNull(campaign.archivedAt))
        .orderBy(desc(campaign.archivedAt), sql`rowid desc`)
        .all()
    }
  }
}

export type CampaignService = ReturnType<typeof createCampaignService>
