import { json } from '@sveltejs/kit'
import { z } from 'zod'
import { getChatPort, isReasoningModelLocked, lockReasoningModel } from '#lib/server/ai/index.ts'
import { runTurn } from '#lib/server/ai/world-conversation.ts'
import { SEED_FIELDS } from '#lib/world/seed.ts'
import type { RequestHandler } from './$types'

const field = z.enum(SEED_FIELDS)

// The body is the client's transcript: bounded so a bad client cannot flood the model.
const bodySchema = z.object({
  seed: z.object(Object.fromEntries(SEED_FIELDS.map((f) => [f, z.string().max(2000)]))),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
  dismissed: z.array(z.object({ field, value: z.string() })),
  pending: z.array(z.object({ field, value: z.string() })).default([]),
  message: z.string().trim().min(1).max(4000)
})

/** One conversation turn. The transcript lives in the browser; nothing is stored here. */
export const POST: RequestHandler = async ({ request }) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid request' }, { status: 400 })

  const port = getChatPort()
  if (!port) return json({ error: 'AI is not configured' }, { status: 503 })

  if (isReasoningModelLocked()) {
    return json({ error: 'AI is disabled until the connection is checked' }, { status: 503 })
  }

  // request.signal fires when the browser drops the request (Stop), cancelling the turn.
  const result = await runTurn(port, parsed.data as Parameters<typeof runTurn>[1], {
    signal: request.signal
  })
  if (!result.ok && result.failure.kind === 'reasoning-model') lockReasoningModel()
  return json(result)
}
