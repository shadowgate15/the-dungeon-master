import { error, fail } from '@sveltejs/kit'
import { buildSummary, detailToSummaryData } from '#lib/character/summary.ts'
import { createCampaignService } from '#lib/server/campaign/service.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { loadWizardRules } from '#lib/server/character/wizard-rules.ts'
import { db } from '#lib/server/db/index.ts'
import { journal, sessions, turnRunner } from '#lib/server/session/index.ts'
import type { Actions, PageServerLoad } from './$types'

const campaigns = createCampaignService(db)
const characters = createCharacterService(db)

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
      number: sessions.listNumbered(campaign.id).find((s) => s.id === found.id)?.number ?? 0
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
    // Read-only World memory for the Journal, with chips against the player's last-looked marker.
    journal: journal.view(campaign.id, found.characterId),
    // The in-memory lock: a reply still being written by another window. Resume never starts one.
    generating: turnRunner.isGenerating(found.id),
    // Derived here from the Character, with the Rules Data on the server.
    sheet: buildSummary(loadWizardRules(), detailToSummaryData(played))
  }
}

export const actions: Actions = {
  /**
   * Advances the Journal's last-looked marker when the overlay closes, to the position the player
   * was shown. It touches only the marker: the Journal itself has no write path.
   */
  journalSeen: async ({ params, request }) => {
    const found = sessions.get(params.sessionId)
    if (!found || found.campaignId !== params.id) error(404, 'Session not found')
    const form = await request.formData()
    const sessionId = form.get('sessionId')
    const seq = Number(form.get('seq'))
    const through =
      typeof sessionId === 'string' && Number.isInteger(seq) && seq >= 0
        ? { sessionId, seq }
        : undefined
    journal.markSeen(found.campaignId, found.characterId, through)
    return { seen: true }
  },

  /** Available in any state except while the DM is generating. */
  end: ({ params }) => {
    const found = sessions.get(params.sessionId)
    if (!found || found.campaignId !== params.id) error(404, 'Session not found')
    if (turnRunner.isGenerating(found.id)) {
      return fail(409, { error: 'The DM is still answering. Stop it first.' })
    }
    sessions.end(found.id)
    return { ended: true }
  }
}
