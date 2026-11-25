import { z } from 'zod'
import { CAMPAIGN_SEED_FIELDS, type CampaignSeed } from '#lib/campaign/seed.ts'
import { campaign } from '../db/schema'
import { ToolError, readTool, type ToolContext } from './contract'

/** The Seed is one Entity per Campaign, so its handle is fixed. */
export const SEED_HANDLE = 'campaign'

export function currentSeed({ db }: ToolContext) {
  const found = db.select().from(campaign).get()
  if (!found) throw ToolError.unknownHandle(SEED_HANDLE)
  return found
}

export function seedView(found: CampaignSeed & { version: number }) {
  const seed = Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, found[f]]))
  return { handle: SEED_HANDLE, version: found.version, ...seed }
}

/** Reading the Campaign Seed; `set_seed` is a creation tool. */
export const seedTools = [
  readTool({
    name: 'seed',
    description:
      'Read the Campaign Seed (name, premise, tone, length and optional World details) and its version.',
    input: z.object({}),
    activity: 'DM checks the Campaign Seed',
    run: (ctx) => seedView(currentSeed(ctx))
  })
]
