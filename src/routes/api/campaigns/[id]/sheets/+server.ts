import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { CampaignMissingError, CampaignNotFoundError } from '#lib/server/campaign/library.ts'
import { playSheets } from '#lib/server/play/sheets.ts'
import type { RequestHandler } from './$types'

/** The Party's play sheets, as the play console shows them, or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) => {
  try {
    return json(playSheets(library.party(params.id)))
  } catch (e) {
    if (e instanceof CampaignNotFoundError || e instanceof CampaignMissingError) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
