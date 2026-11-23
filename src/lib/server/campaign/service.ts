import { asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '../db/connect'
import { campaign, campaignCharacter, character } from '../db/schema'
import { LENGTHS, NAME_MAX, PREMISE_SERVICE_MAX, TONES } from '#lib/campaign/enums.ts'

export type Campaign = typeof campaign.$inferSelect
export type CampaignSeed = Pick<
  typeof campaign.$inferInsert,
  'name' | 'premise' | 'tone' | 'length'
>

/** The input breaks a Campaign rule (blank or over-long text, bad enum, not editable). */
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
    create(seed: CampaignSeed): Campaign {
      const values = validate(seed)
      const at = now()
      return db
        .insert(campaign)
        .values({ ...values, createdAt: at, updatedAt: at })
        .returning()
        .get()
    },

    /** A no-op when already archived. */
    archive(id: string): Campaign {
      return setArchived(id, now())
    },

    /** A no-op when already active. */
    restore(id: string): Campaign {
      return setArchived(id, null)
    },

    /** Hard delete; links cascade. */
    delete(id: string): void {
      const deleted = db.delete(campaign).where(eq(campaign.id, id)).returning().get()
      if (!deleted) throw new CampaignNotFoundError('Campaign not found')
    },

    /** The Campaign's linked Character, if any. The app links one per Campaign. */
    linkedCharacterId(campaignId: string): string | undefined {
      return db
        .select({ id: campaignCharacter.characterId })
        .from(campaignCharacter)
        .where(eq(campaignCharacter.campaignId, campaignId))
        .get()?.id
    },

    /** Removes the Character link. */
    unlinkCharacter(campaignId: string): void {
      db.transaction((tx) => {
        if (!tx.select().from(campaign).where(eq(campaign.id, campaignId)).get()) {
          throw new CampaignNotFoundError('Campaign not found')
        }
        tx.delete(campaignCharacter).where(eq(campaignCharacter.campaignId, campaignId)).run()
      })
    },

    /** Links the Character to the Campaign, replacing any earlier link. */
    linkCharacter(campaignId: string, characterId: string): void {
      db.transaction((tx) => {
        const camp = tx.select().from(campaign).where(eq(campaign.id, campaignId)).get()
        if (!camp) throw new CampaignNotFoundError('Campaign not found')
        if (camp.archivedAt !== null) {
          throw new CampaignValidationError('An archived Campaign cannot be changed')
        }
        const found = tx.select().from(character).where(eq(character.id, characterId)).get()
        if (!found) throw new CampaignValidationError('Character not found')
        if (found.archivedAt !== null) {
          throw new CampaignValidationError('An archived Character cannot be linked')
        }
        tx.delete(campaignCharacter).where(eq(campaignCharacter.campaignId, campaignId)).run()
        tx.insert(campaignCharacter).values({ campaignId, characterId }).run()
      })
    },

    get(id: string): Campaign | undefined {
      return db.select().from(campaign).where(eq(campaign.id, id)).get()
    },

    /** Active Campaigns, oldest first. */
    list(): Campaign[] {
      return db
        .select()
        .from(campaign)
        .where(isNull(campaign.archivedAt))
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
