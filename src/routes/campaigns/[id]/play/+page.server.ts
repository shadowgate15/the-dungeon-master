import { error } from '@sveltejs/kit'
import { SOLO_PLAYER } from '#lib/character/enums.ts'
import { library, sessions } from '#lib/server/campaign/index.ts'
import { permissions, play } from '#lib/server/bridge/index.ts'
import type { PageServerLoad } from './$types'

/** The play console: the Party's sheets, the open Floor, the timeline, the Journal and any permission prompt, begun or not. */
export const load: PageServerLoad = ({ params, locals }) => {
  const entry = library.get(params.id)
  if (!entry) error(404, 'Campaign not found')
  if (entry.status === 'missing') error(404, "This Campaign's folder is missing")
  return {
    campaign: { id: entry.id, name: entry.name, path: entry.path, status: entry.status },
    claims: play.claims(entry.id, locals.browser),
    sheets: play.sheets(entry.id, locals.browser),
    floor: play.openFloor(entry.id, locals.browser),
    timeline: play.timeline(entry.id, locals.browser),
    scene: play.scene(entry.id, locals.browser),
    journal: play.journal(entry.id, locals.browser),
    // Permission prompts are the Host's to answer: a remote browser is never sent one.
    permission: locals.browser === SOLO_PLAYER ? permissions.pending(entry.id) : null,
    attached: sessions.list()
  }
}
