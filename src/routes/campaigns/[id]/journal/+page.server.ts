import { error } from '@sveltejs/kit'
import { library } from '#lib/server/campaign/index.ts'
import type { PageServerLoad } from './$types'

/** The Player's Journal: what their Characters believe, begun or not. */
export const load: PageServerLoad = ({ params }) => {
  const entry = library.get(params.id)
  if (!entry) error(404, 'Campaign not found')
  if (entry.status === 'missing') error(404, "This Campaign's folder is missing")
  return {
    campaign: { id: entry.id, name: entry.name },
    journal: library.record(entry.id).journal()
  }
}
