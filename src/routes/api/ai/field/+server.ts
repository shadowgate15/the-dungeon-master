import { json } from '@sveltejs/kit'
import {
  getAiStatus,
  getChatPort,
  isReasoningModelLocked,
  lockReasoningModel
} from '#lib/server/ai/index.ts'
import { unavailableFailure } from '#lib/server/ai/availability.ts'
import { fieldRequestSchema, runField } from '#lib/server/ai/field-generation.ts'
import type { RequestHandler } from './$types'

/**
 * One stateless field call: write or revise a single field. Nothing is stored. The body is
 * `fieldRequestSchema` (flow, field, mode, the flow's form values, and for feedback the
 * current value and note). Answers `{ ok: true, value }` or `{ ok: false, failure }`.
 */
export const POST: RequestHandler = async ({ request }) => {
  const parsed = fieldRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid request' }, { status: 400 })

  const port = getChatPort()
  if (!port) return json({ error: 'AI is not configured' }, { status: 503 })

  if (isReasoningModelLocked()) {
    return json({ error: 'AI is disabled until the connection is checked' }, { status: 503 })
  }

  // The page's status may be stale (LM Studio stopped since the last check), so every call
  // probes first and reports a down or missing model as such, not as a generic failure.
  const status = await getAiStatus()
  const unavailable = unavailableFailure(status)
  if (unavailable) return json({ ok: false, failure: unavailable, status }, { status: 503 })

  // request.signal fires when the browser drops the request (Stop), cancelling the call.
  const result = await runField(port, parsed.data, { signal: request.signal })
  if (!result.ok && result.failure.kind === 'reasoning-model') lockReasoningModel()
  return json(result)
}
