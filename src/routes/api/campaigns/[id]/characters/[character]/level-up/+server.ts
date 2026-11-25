import { json } from '@sveltejs/kit'
import { live } from '#lib/server/campaign/index.ts'
import { changeParty, readJson } from '#lib/server/character/respond.ts'
import type { RequestHandler } from './$types'

type LevelUpBody = { cantrips?: unknown; spells?: unknown }

const slugs = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : undefined

/**
 * The Player takes a level the DM awarded, with any new cantrips and spells:
 * `{ cantrips?, spells? }` returns `{ id, level }`. 400 `{ error }` without an awarded level or for
 * picks that do not fit; 404 for an unknown Campaign or Character. Works with or without a session.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const body = await readJson<LevelUpBody>(request)
  const picks = body && { cantrips: slugs(body.cantrips) ?? [], spells: slugs(body.spells) ?? [] }
  return changeParty(params.id, picks, (party) => {
    const updated = party.levelUp(params.character, picks!)
    live.publish({ type: 'timeline', campaign: params.id })
    return json({ id: updated.id, level: updated.level })
  })
}
