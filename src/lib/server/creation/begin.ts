import { ne } from 'drizzle-orm'
import { campaignSeedCard, missingSeedFields } from '#lib/campaign/seed.ts'
import type { Queryable } from '../db/connect'
import { campaign, character } from '../db/schema'

/** Where creation stands, which the `session-opening` skill branches on. */
export type CreationState = 'seed_incomplete' | 'party_empty' | 'ready' | 'begun'

/** Begin is not allowed yet (or any more): the message says why. */
export class BeginRefusedError extends Error {}

/** Where the Campaign in this database stands, with the missing Seed fields and saved Characters. */
export function creationStage(db: Queryable): {
  state: CreationState
  missing: string[]
  characters: number
} {
  const found = db.select().from(campaign).get()
  if (!found) throw new Error('The Campaign database has no Campaign')
  const missing = missingSeedFields(campaignSeedCard(found))
  const characters = db
    .select({ id: character.id })
    .from(character)
    .where(ne(character.status, 'departed'))
    .all().length
  const state: CreationState =
    found.begunAt !== null
      ? 'begun'
      : missing.length > 0
        ? 'seed_incomplete'
        : characters === 0
          ? 'party_empty'
          : 'ready'
  return { state, missing, characters }
}

/**
 * Begins the story: sets `begunAt`, which locks the Seed. Refused unless creation is ready (the
 * Seed complete and a Character saved). Nothing in the fiction changes, and nothing awaits Narration.
 */
export function begin(db: Queryable, at: number) {
  const { state } = creationStage(db)
  if (state !== 'ready') {
    throw new BeginRefusedError(
      state === 'begun'
        ? 'The story has already begun'
        : state === 'seed_incomplete'
          ? 'Complete the Seed before you Begin'
          : 'Save a Character to the Party before you Begin'
    )
  }
  db.update(campaign).set({ begunAt: at, updatedAt: at }).run()
}

/** The Seed is locked: the story has begun, and the World was built from it. */
export class SeedLockedError extends Error {}

/**
 * The one guard every Seed write goes through (the Seed card, `set_seed`): after Begin the Seed is
 * read-only until Start over.
 */
export function refuseLockedSeed(found: { begunAt: number | null }) {
  if (found.begunAt !== null) {
    throw new SeedLockedError(
      'The story has begun, so the Seed is locked. Start over to change it.'
    )
  }
}
