import { z } from 'zod'
import {
  CAMPAIGN_SEED_FIELDS,
  CampaignSeedError,
  campaignSeedCard,
  parseCampaignSeed,
  type CampaignSeed
} from '#lib/campaign/seed.ts'
import { campaign } from '../db/schema'
import { ToolError, expectVersion, readTool, writeTool, type ToolContext } from './contract'

/** The Seed is one Entity per Campaign, so its handle is fixed. */
const HANDLE = 'campaign'

function current({ db }: ToolContext) {
  const found = db.select().from(campaign).get()
  if (!found) throw ToolError.unknownHandle(HANDLE)
  return found
}

function view(found: CampaignSeed & { version: number }) {
  const seed = Object.fromEntries(CAMPAIGN_SEED_FIELDS.map((f) => [f, found[f]]))
  return { handle: HANDLE, version: found.version, ...seed }
}

const fields = Object.fromEntries(
  CAMPAIGN_SEED_FIELDS.map((f) => [f, z.string().optional()])
) as Record<(typeof CAMPAIGN_SEED_FIELDS)[number], z.ZodOptional<z.ZodString>>

/** Reading and writing the Campaign Seed: the first versioned Entity the DM can touch. */
export const seedTools = [
  readTool({
    name: 'seed',
    description:
      'Read the Campaign Seed (name, premise, tone, length and optional World details) and its version.',
    input: z.object({}),
    activity: 'DM checks the Campaign Seed',
    run: (ctx) => view(current(ctx))
  }),

  writeTool({
    name: 'set_seed',
    description:
      'Set Campaign Seed fields. Pass the version from your last `seed` read; an empty string clears an optional field.',
    input: z.object({ version: z.int(), ...fields }),
    activity: 'DM updates the Campaign Seed',
    run: (ctx, { version, ...changes }) => {
      const found = current(ctx)
      expectVersion({ handle: HANDLE, version: found.version, read: 'seed' }, version)
      if (found.archivedAt !== null) {
        throw new ToolError('archived', 'An archived Campaign cannot be changed', 'Stop here')
      }
      let seed: CampaignSeed
      try {
        seed = parseCampaignSeed({ ...campaignSeedCard(found), ...changes })
      } catch (e) {
        if (e instanceof CampaignSeedError) throw ToolError.invalidInput('set_seed', e.message)
        throw e
      }
      const saved = ctx.db
        .update(campaign)
        .set({ ...seed, version: found.version + 1, updatedAt: Date.now() })
        .returning()
        .get()
      return {
        result: view(saved),
        event: {
          kind: 'seed_changed',
          summary: `Seed changed: ${Object.keys(changes).join(', ')}`,
          data: changes
        }
      }
    }
  })
]
