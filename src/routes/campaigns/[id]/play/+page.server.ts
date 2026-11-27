import { error } from '@sveltejs/kit'
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
    sheets: play.sheets(entry.id, locals.browser),
    floor: play.openFloor(entry.id, locals.browser),
    timeline: play.timeline(entry.id, locals.browser),
    scene: play.scene(entry.id, locals.browser),
    journal: play.journal(entry.id, locals.browser),
    permission: permissions.pending(entry.id),
    attached: sessions.list()
  }
}
