import { json } from '@sveltejs/kit'
import {
  getAiStatus,
  getChatPort,
  isReasoningModelLocked,
  lockReasoningModel
} from '#lib/server/ai/index.ts'
import { unavailableFailure } from '#lib/server/ai/availability.ts'
import { turnRequestSchema } from '#lib/server/ai/request.ts'
import { runTurn } from '#lib/server/ai/world-conversation.ts'
import type { RequestHandler } from './$types'

/** One conversation turn. The transcript lives in the browser; nothing is stored here. */
export const POST: RequestHandler = async ({ request }) => {
  const parsed = turnRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid request' }, { status: 400 })

  const port = getChatPort()
  if (!port) return json({ error: 'AI is not configured' }, { status: 503 })

  if (isReasoningModelLocked()) {
    return json({ error: 'AI is disabled until the connection is checked' }, { status: 503 })
  }

  // The page's status may be stale (LM Studio stopped since the last check), so every send
  // probes first and reports a down or missing model as such, not as a generic failure.
  const status = await getAiStatus()
  const unavailable = unavailableFailure(status)
  if (unavailable) return json({ ok: false, failure: unavailable, status }, { status: 503 })

  // request.signal fires when the browser drops the request (Stop), cancelling the turn.
  const result = await runTurn(port, parsed.data, { signal: request.signal })
  if (!result.ok && result.failure.kind === 'reasoning-model') lockReasoningModel()
  return json(result)
}
