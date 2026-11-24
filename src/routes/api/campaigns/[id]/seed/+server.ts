import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import type { SeedWithMarks } from '#lib/creation/conversation.ts'
import type { RequestHandler } from './$types'

/** The Campaign Seed and the fields the DM set ("✎ DM"), or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) => {
  try {
    const body: SeedWithMarks = {
      seed: library.seed(params.id),
      dmFields: library.dmSeedFields(params.id)
    }
    return json(body)
  } catch (e) {
    if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
