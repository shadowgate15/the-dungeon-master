import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import type { SeedWithMarks } from '#lib/creation/conversation.ts'
import type { RequestHandler } from './$types'

/** The Campaign Seed and the fields the DM set ("✎ DM"), or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) =>
  withCampaign(() => {
    const body: SeedWithMarks = {
      seed: library.seed(params.id),
      dmFields: library.dmSeedFields(params.id)
    }
    return json(body)
  })
