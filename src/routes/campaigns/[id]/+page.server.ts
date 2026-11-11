import { error, fail, redirect } from '@sveltejs/kit'
import { resolve } from '$app/paths'
import { createCampaignService } from '#lib/server/campaign/service.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { db } from '#lib/server/db/index.ts'
import {
  createSessionService,
  SessionAlreadyOpenError,
  SessionValidationError
} from '#lib/server/session/service.ts'
import type { Actions, PageServerLoad } from './$types'

const campaigns = createCampaignService(db)
const characters = createCharacterService(db)
const sessions = createSessionService(db)

export const load: PageServerLoad = ({ params }) => {
  const found = campaigns.get(params.id)
  if (!found) error(404, 'Campaign not found')
  const linkedId = sessions.linkedCharacterId(found.id)
  const open = sessions.openFor(found.id)
  return {
    campaign: {
      id: found.id,
      name: found.name,
      premise: found.premise,
      archived: found.archivedAt !== null,
      readOnly: campaigns.isReadOnly(found.id)
    },
    linkedCharacter: linkedId ? { id: linkedId, name: characters.get(linkedId)?.name ?? '' } : null,
    characters: characters.list().map((c) => ({ id: c.id, name: c.name })),
    openSessionId: open?.id ?? null,
    // Oldest first, so the number shown for a Session never changes.
    sessions: sessions
      .list(found.id)
      .reverse()
      .map((s, i) => ({ id: s.id, number: i + 1, startedAt: s.startedAt, endedAt: s.endedAt }))
  }
}

export const actions: Actions = {
  linkCharacter: async ({ request, params }) => {
    const characterId = String((await request.formData()).get('characterId') ?? '')
    try {
      sessions.linkCharacter(params.id, characterId)
    } catch (e) {
      if (e instanceof SessionValidationError) return fail(400, { error: e.message })
      throw e
    }
    return { linked: true }
  },

  /** Starting never calls the model, so it works while the model is down. */
  startSession: ({ params }) => {
    let started
    try {
      started = sessions.start(params.id)
    } catch (e) {
      if (e instanceof SessionAlreadyOpenError || e instanceof SessionValidationError)
        return fail(400, { error: e.message })
      throw e
    }
    redirect(
      303,
      resolve('/campaigns/[id]/sessions/[sessionId]', {
        id: params.id,
        sessionId: started.id
      }) + '?opening'
    )
  }
}
