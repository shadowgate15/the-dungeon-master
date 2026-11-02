import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

// Archived Worlds now live behind the Archived view of the Worlds table.
export const load: PageServerLoad = () => redirect(307, '/?view=archived')
