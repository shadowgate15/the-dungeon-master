// PROTOTYPE (throwaway): resets the in-memory scenario.
import { json } from '@sveltejs/kit'
import { isBusy, resetWorld } from '#lib/server/prototype/engine.ts'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = () => {
  if (isBusy()) return json({ error: 'in-flight' }, { status: 409 })
  return json({ state: resetWorld() })
}
