import { json } from '@sveltejs/kit'
import { getChatPort, isReasoningModelLocked, lockReasoningModel } from '#lib/server/ai/index.ts'
import {
  compactCharacterConversation,
  type CharacterTurnInput
} from '#lib/server/ai/character-conversation.ts'
import { characterCompactRequestSchema } from '#lib/server/ai/request.ts'
import type { RequestHandler } from './$types'

/** Manual "Compact now": summarizes older messages, model-facing only; nothing is stored. */
export const POST: RequestHandler = async ({ request }) => {
  const parsed = characterCompactRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid request' }, { status: 400 })

  const port = getChatPort()
  if (!port) return json({ error: 'AI is not configured' }, { status: 503 })
  if (isReasoningModelLocked()) {
    return json({ error: 'AI is disabled until the connection is checked' }, { status: 503 })
  }

  const result = await compactCharacterConversation(
    port,
    { ...(parsed.data as CharacterTurnInput), message: '' },
    { signal: request.signal }
  )
  if (!result.ok && result.failure.kind === 'reasoning-model') lockReasoningModel()
  return json(result)
}
