import { error } from '@sveltejs/kit'
import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import { createCampaignService } from '#lib/server/campaign/service.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { loadWizardRules } from '#lib/server/character/wizard-rules.ts'
import { db } from '#lib/server/db/index.ts'
import { createSessionService } from '#lib/server/session/service.ts'
import type { Actions, PageServerLoad } from './$types'

const campaigns = createCampaignService(db)
const characters = createCharacterService(db)
const sessions = createSessionService(db)

export const load: PageServerLoad = ({ params }) => {
  const found = sessions.get(params.sessionId)
  const campaign = campaigns.get(params.id)
  if (!found || !campaign || found.campaignId !== campaign.id) error(404, 'Session not found')
  const played = characters.get(found.characterId)
  if (!played) error(404, 'Character not found')
  return {
    campaign: { id: campaign.id, name: campaign.name },
    session: {
      id: found.id,
      startedAt: found.startedAt,
      endedAt: found.endedAt,
      // Oldest first, so the number shown for a Session never changes.
      number:
        sessions
          .list(campaign.id)
          .reverse()
          .findIndex((s) => s.id === found.id) + 1
    },
    turns: sessions.turns(found.id).map((t) => ({
      id: t.id,
      seq: t.seq,
      author: t.author,
      kind: t.kind,
      text: t.text,
      rollRequest: t.rollRequest,
      rollResult: t.rollResult
    })),
    // Derived here from the Character, with the Rules Data on the server.
    sheet: buildSummary(loadWizardRules(), detailToSummaryData(played))
  }
}

export const actions: Actions = {
  /** Always available except while the DM is generating, which a later ticket guards. */
  end: ({ params }) => {
    const found = sessions.get(params.sessionId)
    if (!found || found.campaignId !== params.id) error(404, 'Session not found')
    sessions.end(found.id)
    return { ended: true }
  }
}
