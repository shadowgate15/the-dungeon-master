import { json } from '@sveltejs/kit'
import { library } from '../campaign/index'
import { CampaignMissingError, CampaignNotFoundError } from '../campaign/library'
import { DmOnlyEditError, DraftNotFoundError, type Party } from './party'
import { CharacterNotFoundError, CharacterValidationError } from './service'

const UNREADABLE = 'The Character could not be read. Try saving again.'

/** Reads a JSON request body, or undefined when it is not JSON. */
export async function readJson<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T
  } catch {
    return undefined
  }
}

/**
 * Runs a Party change for an API route. A broken rule comes back as 400 `{ error }` so the wizard
 * keeps the draft and shows it; an unknown Campaign, draft or Character as 404 `{ error }`. An
 * archived Campaign is read-only. An edit that is the DM's while the DM is away is 409 `{ error }`.
 */
export function changeParty(
  campaignId: string,
  body: unknown,
  change: (party: Party) => Response
): Response {
  if (body === undefined) return json({ error: UNREADABLE }, { status: 400 })
  try {
    if (library.get(campaignId)?.status === 'archived') {
      return json({ error: 'An archived Campaign cannot be changed' }, { status: 400 })
    }
    return change(library.party(campaignId))
  } catch (e) {
    if (e instanceof DmOnlyEditError) return json({ error: e.message }, { status: 409 })
    if (e instanceof CharacterValidationError) return json({ error: e.message }, { status: 400 })
    if (
      e instanceof CampaignNotFoundError ||
      e instanceof CampaignMissingError ||
      e instanceof DraftNotFoundError ||
      e instanceof CharacterNotFoundError
    ) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
