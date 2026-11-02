import { json } from '@sveltejs/kit'
import { getChatPort, isReasoningModelLocked, lockReasoningModel } from '#lib/server/ai/index.ts'
import { compactCampaignConversation } from '#lib/server/ai/campaign-conversation.ts'
import { campaignCompactRequestSchema } from '#lib/server/ai/request.ts'
import type { RequestHandler } from './$types'

/** Manual "Compact now": summarizes older messages, model-facing only; nothing is stored. */
export const POST: RequestHandler = async ({ request }) => {
  const parsed = campaignCompactRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid request' }, { status: 400 })

  const port = getChatPort()
  if (!port) return json({ error: 'AI is not configured' }, { status: 503 })
  if (isReasoningModelLocked()) {
    return json({ error: 'AI is disabled until the connection is checked' }, { status: 503 })
  }

  const result = await compactCampaignConversation(
    port,
    { ...parsed.data, message: '' },
    { signal: request.signal }
  )
  if (!result.ok && result.failure.kind === 'reasoning-model') lockReasoningModel()
  return json(result)
}
