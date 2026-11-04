import { json } from '@sveltejs/kit'
import {
  getAiStatus,
  getChatPort,
  isReasoningModelLocked,
  lockReasoningModel
} from '#lib/server/ai/index.ts'
import { unavailableFailure } from '#lib/server/ai/availability.ts'
import { runCharacterTurn, type CharacterTurnInput } from '#lib/server/ai/character-conversation.ts'
import { characterTurnRequestSchema } from '#lib/server/ai/request.ts'
import { db } from '#lib/server/db/index.ts'
import { createRulesRepository } from '#lib/server/rules/repository.ts'
import type { RequestHandler } from './$types'

/**
 * One Character conversation turn. The draft is browser-only: it arrives with the active step,
 * and its slugs are resolved against Rules Data here each turn.
 */
export const POST: RequestHandler = async ({ request }) => {
  const parsed = characterTurnRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid request' }, { status: 400 })

  const port = getChatPort()
  if (!port) return json({ error: 'AI is not configured' }, { status: 503 })

  if (isReasoningModelLocked()) {
    return json({ error: 'AI is disabled until the connection is checked' }, { status: 503 })
  }

  const status = await getAiStatus()
  const unavailable = unavailableFailure(status)
  if (unavailable) return json({ ok: false, failure: unavailable, status }, { status: 503 })

  const result = await runCharacterTurn(
    port,
    createRulesRepository(db),
    parsed.data as CharacterTurnInput,
    {
      signal: request.signal
    }
  )
  if (!result.ok && result.failure.kind === 'reasoning-model') lockReasoningModel()
  return json(result)
}
