// PROTOTYPE (throwaway): initial scene state for the prototype page.
import { error } from '@sveltejs/kit'
import { dev } from '$app/env'
import { getChatPort } from '#lib/server/ai/index.ts'
import { STEP_CAP, snapshot } from '#lib/server/prototype/engine.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = () => {
  if (!dev) error(404)
  return { state: snapshot(), aiConfigured: getChatPort() !== null, stepCap: STEP_CAP }
}
