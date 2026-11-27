import { error, fail } from '@sveltejs/kit'
import { play } from '#lib/server/bridge/index.ts'
import { library, sessions } from '#lib/server/campaign/index.ts'
import { CampaignArchivedError } from '#lib/server/campaign/library.ts'
import { BeginRefusedError, StartOverRefusedError } from '#lib/server/creation/begin.ts'
import { DmAwayError } from '#lib/server/play/play.ts'
import type { Actions, PageServerLoad } from './$types'

/** The Begin step: whether the story can begin, and after Begin the pitch and Start over. */
export const load: PageServerLoad = ({ params }) => {
  const entry = library.get(params.id)
  if (!entry) error(404, 'Campaign not found')
  if (entry.status === 'missing') error(404, "This Campaign's folder is missing")
  const record = library.record(entry.id)
  return {
    campaign: { id: entry.id, name: entry.name, path: entry.path, status: entry.status },
    creation: library.creation(entry.id),
    journal: record.journal(),
    timeline: record.timeline(),
    conversation: library.conversation(entry.id).list(),
    attached: sessions.list()
  }
}

export const actions: Actions = {
  begin: ({ params, locals }) => {
    try {
      play.begin(params.id, locals.browser)
    } catch (e) {
      if (e instanceof DmAwayError) return fail(409, { error: e.message })
      if (e instanceof BeginRefusedError || e instanceof CampaignArchivedError) {
        return fail(400, { error: e.message })
      }
      throw e
    }
    return { begun: true }
  },

  startOver: ({ params }) => {
    try {
      play.startOver(params.id)
    } catch (e) {
      if (e instanceof StartOverRefusedError || e instanceof CampaignArchivedError) {
        return fail(400, { error: e.message })
      }
      throw e
    }
    return { startedOver: true }
  }
}
