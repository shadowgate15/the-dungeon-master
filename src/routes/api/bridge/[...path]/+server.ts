import { bridgeApi } from '#lib/server/bridge/index.ts'
import type { RequestHandler } from './$types'

/** The bridge's token-gated interface: tools, calls and channel events. See `bridge/api.ts`. */
const handle: RequestHandler = ({ request }) => bridgeApi(request)

export const GET = handle
export const POST = handle
