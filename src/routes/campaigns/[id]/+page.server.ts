import { error, fail, redirect } from '@sveltejs/kit'
import { resolve } from '$app/paths'
import { createCampaignService } from '#lib/server/campaign/service.ts'
import { createCharacterService } from '#lib/server/character/service.ts'
import { arcs } from '#lib/server/arc/index.ts'
import { db } from '#lib/server/db/index.ts'
import { SessionAlreadyOpenError, SessionValidationError } from '#lib/server/session/service.ts'
import { sessions, turnRunner } from '#lib/server/session/index.ts'
import type { Actions, PageServerLoad } from './$types'

const campaigns = createCampaignService(db)
const characters = createCharacterService(db)

export const load: PageServerLoad = ({ params }) => {
  const found = campaigns.get(params.id)
  if (!found) error(404, 'Campaign not found')
  const linkedId = sessions.linkedCharacterId(found.id)
  const open = sessions.openFor(found.id)
  const numbered = sessions.listNumbered(found.id)
  const numberOf = new Map(numbered.map((s) => [s.id, s.number]))
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
    characters: characters.list().map((c) => ({ id: c.id, name: c.name })),
    arc: arc && {
      ...arc,
      acts: arc.acts.map((a) => ({
        ...a,
        beats: a.beats.map((b) => ({
          ...b,
          sessionNumber: b.sourceSessionId ? (numberOf.get(b.sourceSessionId) ?? null) : null
        }))
      }))
    },
    arcAvailability: arcs.availability(found.id),
    openSessionId: open?.id ?? null,
    sessions: numbered.map((s) => ({
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
      sessions.linkCharacter(params.id, characterId)
    } catch (e) {
      if (e instanceof SessionValidationError) return fail(400, { error: e.message })
      throw e
    }
    return { linked: true }
  },

  /**
   * Starting never calls the model, so it works while the model is down. It first lets pending
   * extraction finish (bounded by a timeout) so the new Session opens with what the last one
   * established.
   */
  startSession: async ({ params }) => {
    await turnRunner.drainMemory()
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
