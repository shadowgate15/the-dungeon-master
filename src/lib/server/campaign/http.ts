import { json } from '@sveltejs/kit'
import {
  CampaignArchivedError,
  CampaignMissingError,
  CampaignNotFoundError,
  type CampaignLibrary
} from './library'

/** An error a route answers with a status and `{ error }`, rather than a 500. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Refusal = [error: new (...args: any[]) => Error, status: number]

/** What every Campaign route refuses: an unknown or missing Campaign, an archived one. */
const CAMPAIGN_REFUSALS: Refusal[] = [
  [CampaignNotFoundError, 404],
  [CampaignMissingError, 404],
  [CampaignArchivedError, 400]
]

/**
 * Runs a Campaign route, answering a refused request with its status and `{ error }`: 404 for an
 * unknown or missing Campaign, 400 for an archived one, and the route's own `refusals`. Anything
 * else is rethrown.
 */
export async function withCampaign(
  run: () => Response | Promise<Response>,
  refusals: Refusal[] = []
): Promise<Response> {
  try {
    return await run()
  } catch (e) {
    const refused = [...refusals, ...CAMPAIGN_REFUSALS].find(([type]) => e instanceof type)
    if (refused) return json({ error: (e as Error).message }, { status: refused[1] })
    throw e
  }
}

/** Refuses play on an archived Campaign (400 through `withCampaign`). */
export function assertPlayable(library: CampaignLibrary, id: string): void {
  if (library.get(id)?.status === 'archived') {
    throw new CampaignArchivedError('An archived Campaign cannot be played')
  }
}
