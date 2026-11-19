import { error, fail, redirect } from '@sveltejs/kit'
import { resolve } from '$app/paths'
import {
  CampaignNotFoundError,
  CampaignValidationError,
  createCampaignService
} from '#lib/server/campaign/service.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { arcs } from '#lib/server/arc/index.ts'
import { db } from '#lib/server/db/index.ts'
import {
  SessionAlreadyOpenError,
  SessionStartError,
  SessionValidationError
} from '#lib/server/session/service.ts'
import { sessions } from '#lib/server/session/index.ts'
import type { Actions, PageServerLoad } from './$types'

const campaigns = createCampaignService(db)
const characters = createCharacterService(db)

export const load: PageServerLoad = ({ params }) => {
  const found = campaigns.get(params.id)
  if (!found) error(404, 'Campaign not found')
  const linkedId = campaigns.linkedCharacterId(found.id)
  const arc = arcs.get(found.id)
  return {
    campaign: {
      id: found.id,
      name: found.name,
      premise: found.premise,
      length: found.length,
      archived: found.archivedAt !== null,
      readOnly: campaigns.isReadOnly(found.id)
    },
    linkedCharacter: linkedId ? { id: linkedId, name: characters.get(linkedId)?.name ?? '' } : null,
    characterLocked: campaigns.characterLocked(found.id),
    characters: characters.list().map((c) => ({ id: c.id, name: c.name })),
    arc,
    arcAvailability: arcs.availability(found.id),
    openSessionId: sessions.openFor(found.id)?.id ?? null,
    sessions: sessions.listNumbered(found.id).map((s) => ({
      id: s.id,
      number: s.number,
      startedAt: s.startedAt,
      endedAt: s.endedAt
    }))
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
  },

  startSession: async ({ params }) => {
    let started
    try {
      started = await sessions.start(params.id)
    } catch (e) {
      if (e instanceof SessionAlreadyOpenError || e instanceof SessionValidationError)
        return fail(400, { error: e.message })
      // The opening Scene could not be generated: nothing was created, the player may retry.
      if (e instanceof SessionStartError) return fail(502, { error: e.message, retry: true })
      throw e
    }
    redirect(
      303,
      resolve('/campaigns/[id]/sessions/[sessionId]', { id: params.id, sessionId: started.id })
    )
  }
}
