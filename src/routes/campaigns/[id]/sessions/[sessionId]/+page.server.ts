import { error } from '@sveltejs/kit'
import { createCampaignService } from '#lib/server/campaign/service.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { db } from '#lib/server/db/index.ts'
import { sessions } from '#lib/server/session/index.ts'
import type { Actions, PageServerLoad } from './$types'

const campaigns = createCampaignService(db)
const characters = createCharacterService(db)

export const load: PageServerLoad = ({ params }) => {
  const found = sessions.get(params.sessionId)
  const campaign = campaigns.get(params.id)
  if (!found || !campaign || found.campaignId !== campaign.id) error(404, 'Session not found')
  return {
    campaign: { id: campaign.id, name: campaign.name },
    character: { name: characters.get(found.characterId)?.name ?? '' },
    session: {
      id: found.id,
      startedAt: found.startedAt,
      endedAt: found.endedAt,
      number: sessions.listNumbered(campaign.id).find((s) => s.id === found.id)?.number ?? 0
    },
    scene: sessions.scene(found.id),
    events: sessions.events(found.id)
  }
}

export const actions: Actions = {
  end: ({ params }) => {
    const found = sessions.get(params.sessionId)
    if (!found || found.campaignId !== params.id) error(404, 'Session not found')
    sessions.end(found.id)
    return { ended: true }
  }
}
