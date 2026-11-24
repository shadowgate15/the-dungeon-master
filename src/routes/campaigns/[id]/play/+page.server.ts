import { error } from '@sveltejs/kit'
import { library, sessions } from '#lib/server/campaign/index.ts'
import { permissions, play } from '#lib/server/bridge/index.ts'
import { playSheets } from '#lib/server/play/sheets.ts'
import type { PageServerLoad } from './$types'

/** The play console: the Party's sheets, the open Floor, the timeline and any permission prompt, begun or not. */
export const load: PageServerLoad = ({ params }) => {
  const entry = library.get(params.id)
  if (!entry) error(404, 'Campaign not found')
  if (entry.status === 'missing') error(404, "This Campaign's folder is missing")
  return {
    campaign: { id: entry.id, name: entry.name, path: entry.path, status: entry.status },
    sheets: playSheets(library.party(entry.id)),
    floor: library.floor(entry.id).current(),
    timeline: play.timeline(entry.id),
    permission: permissions.pending(entry.id),
    attached: sessions.list()
  }
}
