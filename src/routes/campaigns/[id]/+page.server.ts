import { error, fail } from '@sveltejs/kit'
import {
  CampaignNotFoundError,
  CampaignValidationError,
  createCampaignService
} from '#lib/server/campaign/service.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { db } from '#lib/server/db/index.ts'
import type { Actions, PageServerLoad } from './$types'

const campaigns = createCampaignService(db)
const characters = createCharacterService(db)

export const load: PageServerLoad = ({ params }) => {
  const found = campaigns.get(params.id)
  if (!found) error(404, 'Campaign not found')
  const linkedId = campaigns.linkedCharacterId(found.id)
  return {
    campaign: {
      id: found.id,
      name: found.name,
      premise: found.premise,
      archived: found.archivedAt !== null
    },
    linkedCharacter: linkedId ? { id: linkedId, name: characters.get(linkedId)?.name ?? '' } : null,
    characters: characters.list().map((c) => ({ id: c.id, name: c.name }))
  }
}

export const actions: Actions = {
  linkCharacter: async ({ request, params }) => {
    const characterId = String((await request.formData()).get('characterId') ?? '')
    try {
      campaigns.linkCharacter(params.id, characterId)
    } catch (e) {
      if (e instanceof CampaignValidationError || e instanceof CampaignNotFoundError)
        return fail(400, { error: e.message })
      throw e
    }
    return { linked: true }
  },

  unlinkCharacter: async ({ params }) => {
    try {
      campaigns.unlinkCharacter(params.id)
    } catch (e) {
      if (e instanceof CampaignValidationError || e instanceof CampaignNotFoundError)
        return fail(400, { error: e.message })
      throw e
    }
    return { unlinked: true }
  }
}
