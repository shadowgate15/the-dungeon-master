import { redirect } from '@sveltejs/kit'
import { resolve } from '$app/paths'
import type { PageServerLoad } from './$types'

/** The Campaign library is the home page. */
export const load: PageServerLoad = () => {
  redirect(307, resolve('/campaigns'))
}
