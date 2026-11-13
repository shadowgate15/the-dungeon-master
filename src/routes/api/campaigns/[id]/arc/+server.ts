import { json } from '@sveltejs/kit'
import { z } from 'zod'
import {
  getAiStatus,
  getChatPort,
  isReasoningModelLocked,
  lockReasoningModel
} from '#lib/server/ai/index.ts'
import { unavailableFailure } from '#lib/server/ai/availability.ts'
import { arcs } from '#lib/server/arc/index.ts'
import { generateArc } from '#lib/server/arc/generate.ts'
import { ArcLockedError, ArcValidationError } from '#lib/server/arc/service.ts'
import { createCampaignService } from '#lib/server/campaign/service.ts'
import { db } from '#lib/server/db/index.ts'
import type { RequestHandler } from './$types'

const campaigns = createCampaignService(db)

const text = z.string()
const editSchema = z.object({
  title: text,
  premise: text,
  stakes: text,
  resolution: text,
  acts: z.array(
    z.object({
      id: z.string().optional(),
      name: text,
      purpose: text,
      beats: z.array(z.object({ id: z.string().optional(), title: text, description: text }))
    })
  )
})

const bodySchema = z.union([
  z.object({ action: z.literal('generate') }),
  z.object({ action: z.literal('save'), arc: editSchema, accept: z.boolean().optional() })
])

function problem(error: unknown) {
  if (error instanceof ArcLockedError) return json({ error: error.message }, { status: 409 })
  if (error instanceof ArcValidationError) return json({ error: error.message }, { status: 400 })
  throw error
}

/**
 * The Campaign page's Arc actions. `generate` runs one structured call and, on success,
 * replaces the whole Arc with a draft; on failure or Stop the current Arc is untouched.
 * `save` stores the player's edits, and with `accept` accepts the Arc. Answers
 * `{ ok: true }` or `{ ok: false, failure }` (generation) / `{ error }` (anything else).
 */
export const POST: RequestHandler = async ({ request, params }) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid request' }, { status: 400 })
  const campaign = campaigns.get(params.id)
  if (!campaign) return json({ error: 'Campaign not found' }, { status: 404 })
  const body = parsed.data

  try {
    if (body.action === 'save') {
      arcs.save(campaign.id, body.arc, { accept: body.accept })
      return json({ ok: true })
    }

    if (!arcs.availability(campaign.id).canGenerate) {
      return json({ error: 'An Arc cannot be generated for this Campaign' }, { status: 409 })
    }
    const port = getChatPort()
    if (!port) return json({ error: 'AI is not configured' }, { status: 503 })
    if (isReasoningModelLocked()) {
      return json({ error: 'AI is disabled until the connection is checked' }, { status: 503 })
    }
    const status = await getAiStatus()
    const unavailable = unavailableFailure(status)
    if (unavailable) return json({ ok: false, failure: unavailable, status }, { status: 503 })

    // request.signal fires when the browser drops the request (Stop), cancelling the call.
    const result = await generateArc(
      port,
      {
        name: campaign.name,
        premise: campaign.premise,
        tone: campaign.tone,
        length: campaign.length,
        worlds: campaign.worlds.map((w) => ({ name: w.name, premise: w.premise }))
      },
      { signal: request.signal }
    )
    if (!result.ok) {
      if (result.failure.kind === 'reasoning-model') lockReasoningModel()
      return json(result)
    }
    arcs.replaceWithDraft(campaign.id, result.arc)
    return json({ ok: true })
  } catch (error) {
    return problem(error)
  }
}
