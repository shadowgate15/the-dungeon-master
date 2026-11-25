import { stop } from '#lib/server/bridge/index.ts'
import type { RequestHandler } from './$types'

/**
 * The UI's stop control: stops the game server, as `dm stop` does. 202; the server exits just
 * after. Like every browser route, only a page served from this machine may call it.
 */
export const POST: RequestHandler = () => {
  stop()
  return new Response(null, { status: 202 })
}
