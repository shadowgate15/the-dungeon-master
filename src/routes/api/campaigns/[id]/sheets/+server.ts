import { json } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import { withCampaign } from '#lib/server/campaign/http.ts'
import { playSheets } from '#lib/server/play/sheets.ts'
import type { RequestHandler } from './$types'

/** The Party's play sheets, as the play console shows them, or 404 `{ error }`. */
export const GET: RequestHandler = ({ params }) =>
  withCampaign(() => json(playSheets(library.party(params.id))))
