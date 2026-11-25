import { live } from '#lib/server/campaign/index.ts'
import type { RequestHandler } from './$types'

/** The browser's live updates: one SSE stream of state changes. See `lib/server/live.ts`. */
export const GET: RequestHandler = () => live.stream()
