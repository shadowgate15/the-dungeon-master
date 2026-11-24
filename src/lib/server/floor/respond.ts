import { json } from '@sveltejs/kit'
import { play } from '../bridge/index'
import { library, live } from '../campaign/index'
import { CampaignMissingError, CampaignNotFoundError } from '../campaign/library'
import { DmAwayError } from '../play/play'
import { DeclarationNotFoundError, DeclarationRefusedError, type Floor } from './floor'

const UNREADABLE = 'The Declaration could not be read. Try sending it again.'

/**
 * Runs a change to a Campaign's open Floor for an API route, then tells every browser tab the
 * Floor changed. A refused Declaration comes back as 400 `{ error }`; an unknown Campaign or
 * Declaration as 404 `{ error }`. An archived Campaign is read-only. Declarations are play input:
 * refused with 409 while the DM is away, unless `offline` (the Player's own returned drafts).
 */
export function changeFloor(
  campaignId: string,
  body: unknown,
  change: (floor: Floor) => Response,
  { offline = false }: { offline?: boolean } = {}
): Response {
  if (body === undefined) return json({ error: UNREADABLE }, { status: 400 })
  try {
    if (library.get(campaignId)?.status === 'archived') {
      return json({ error: 'An archived Campaign cannot be changed' }, { status: 400 })
    }
    const response = change(offline ? library.floor(campaignId) : play.floor(campaignId))
    live.publish({ type: 'floor', campaign: campaignId })
    return response
  } catch (e) {
    if (e instanceof DmAwayError) return json({ error: e.message }, { status: 409 })
    if (e instanceof DeclarationRefusedError) return json({ error: e.message }, { status: 400 })
    if (
      e instanceof CampaignNotFoundError ||
      e instanceof CampaignMissingError ||
      e instanceof DeclarationNotFoundError
    ) {
      return json({ error: e.message }, { status: 404 })
    }
    throw e
  }
}
