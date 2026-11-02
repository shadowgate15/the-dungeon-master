import { json } from '@sveltejs/kit'
import {
  getAiStatus,
  getChatPort,
  isReasoningModelLocked,
  lockReasoningModel
} from '#lib/server/ai/index.ts'
import { unavailableFailure } from '#lib/server/ai/availability.ts'
import { runCampaignTurn } from '#lib/server/ai/campaign-conversation.ts'
import { campaignTurnRequestSchema } from '#lib/server/ai/request.ts'
import { db } from '#lib/server/db/index.ts'
import type { RequestHandler } from './$types'

/**
 * One Campaign conversation turn, shared by create and edit. The transcript lives in the
 * browser; the selected Worlds are sent as ids and loaded here each turn.
 */
export const POST: RequestHandler = async ({ request }) => {
  const parsed = campaignTurnRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid request' }, { status: 400 })

  const port = getChatPort()
  if (!port) return json({ error: 'AI is not configured' }, { status: 503 })

  if (isReasoningModelLocked()) {
    return json({ error: 'AI is disabled until the connection is checked' }, { status: 503 })
  }

  const status = await getAiStatus()
  const unavailable = unavailableFailure(status)
  if (unavailable) return json({ ok: false, failure: unavailable, status }, { status: 503 })

  const result = await runCampaignTurn(port, db, parsed.data, { signal: request.signal })
  if (!result.ok && result.failure.kind === 'reasoning-model') lockReasoningModel()
  return json(result)
}
