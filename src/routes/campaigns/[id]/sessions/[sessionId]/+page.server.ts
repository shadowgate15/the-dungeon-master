import { error } from '@sveltejs/kit'
import { createCampaignService } from '#lib/server/campaign/service.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { db } from '#lib/server/db/index.ts'
import { createJournal } from '#lib/server/memory/journal.ts'
import { readMemoryInspector } from '#lib/server/memory/inspector.ts'
import {
  memoryExtraction,
  rollingSummary,
  sessionEnd,
  sessions
} from '#lib/server/session/index.ts'
import { clientEvent, clientScene } from '#lib/server/session/client-view.ts'
import type { Actions, PageServerLoad } from './$types'

const campaigns = createCampaignService(db)
const characters = createCharacterService(db)
const journal = createJournal(db)

export const load: PageServerLoad = ({ params, cookies }) => {
  const found = sessions.get(params.sessionId)
  const campaign = campaigns.get(params.id)
  if (!found || !campaign || found.campaignId !== campaign.id) error(404, 'Session not found')
  // The DC of a Check never reaches the client.
  const events = sessions.events(found.id).map(clientEvent)
  // "Previously" is for a new Session's first view only: open, before the first Declaration, and not
  // seen before (a cookie marks the view, so resuming the Session later does not repeat it).
  const seenKey = `previously-${found.id}`
  const firstView = found.endedAt === null && events.length === 0 && !cookies.get(seenKey)
  const recap = firstView ? rollingSummary.recap(campaign.id, found.id) : undefined
  if (firstView) cookies.set(seenKey, '1', { path: '/', maxAge: 60 * 60 * 24 * 365 })
  return {
    campaign: { id: campaign.id, name: campaign.name },
    character: { name: characters.get(found.characterId)?.name ?? '' },
    session: {
      id: found.id,
      startedAt: found.startedAt,
      endedAt: found.endedAt,
      number: sessions.listNumbered(campaign.id).find((s) => s.id === found.id)?.number ?? 0
    },
    scene: clientScene(sessions.scene(found.id)),
    events,
    recap: recap ?? null,
    journal: journal.read(campaign.id, found.characterId),
    // For the dev-only inspector's Memory section.
    memory: import.meta.env.DEV
      ? readMemoryInspector(db, memoryExtraction, rollingSummary, found.id, events.at(-1)?.seq ?? 0)
      : null
  }
}

export const actions: Actions = {
  end: async ({ params }) => {
    const found = sessions.get(params.sessionId)
    if (!found || found.campaignId !== params.id) error(404, 'Session not found')
    await sessionEnd.end(found.id)
    return { ended: true }
  }
}
